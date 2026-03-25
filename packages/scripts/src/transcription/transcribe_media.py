#!/usr/bin/env python3
import argparse
import json
import math
import subprocess
from pathlib import Path

from faster_whisper import WhisperModel


def run_command(command: list[str]) -> None:
    subprocess.run(command, check=True)


def ffprobe_duration(file_path: Path) -> float | None:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(file_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout or "{}")
    duration = payload.get("format", {}).get("duration")
    try:
        value = float(duration)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def format_srt_timestamp(seconds: float) -> str:
    total_ms = max(0, int(round(seconds * 1000)))
    hours = total_ms // 3_600_000
    minutes = (total_ms % 3_600_000) // 60_000
    secs = (total_ms % 60_000) // 1000
    ms = total_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def format_vtt_timestamp(seconds: float) -> str:
    total_ms = max(0, int(round(seconds * 1000)))
    hours = total_ms // 3_600_000
    minutes = (total_ms % 3_600_000) // 60_000
    secs = (total_ms % 60_000) // 1000
    ms = total_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def write_sidecar_files(output_dir: Path, segments: list[dict], transcript_text: str) -> dict:
    txt_path = output_dir / "transcript.txt"
    srt_path = output_dir / "transcript.srt"
    vtt_path = output_dir / "transcript.vtt"
    json_path = output_dir / "transcript.json"

    txt_path.write_text(transcript_text.strip() + "\n", encoding="utf-8")

    srt_lines: list[str] = []
    vtt_lines: list[str] = ["WEBVTT", ""]
    for index, segment in enumerate(segments, start=1):
        start_time = float(segment["startTime"])
        end_time = float(segment["endTime"])
        text = str(segment["text"]).strip()
        srt_lines.extend(
            [
                str(index),
                f"{format_srt_timestamp(start_time)} --> {format_srt_timestamp(end_time)}",
                text,
                "",
            ]
        )
        vtt_lines.extend(
            [
                f"{format_vtt_timestamp(start_time)} --> {format_vtt_timestamp(end_time)}",
                text,
                "",
            ]
        )

    srt_path.write_text("\n".join(srt_lines).strip() + "\n", encoding="utf-8")
    vtt_path.write_text("\n".join(vtt_lines).strip() + "\n", encoding="utf-8")
    json_path.write_text(
        json.dumps(
            {
                "transcriptText": transcript_text,
                "segments": segments,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    return {
        "txt": str(txt_path),
        "srt": str(srt_path),
        "vtt": str(vtt_path),
        "json": str(json_path),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--model-size", default="small")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--beam-size", type=int, default=5)
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    audio_path = output_dir / "audio.wav"
    run_command(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            str(audio_path),
        ]
    )

    model = WhisperModel(args.model_size, device=args.device, compute_type=args.compute_type)
    segments_iter, info = model.transcribe(
        str(audio_path),
        beam_size=args.beam_size,
        vad_filter=True,
        word_timestamps=False,
    )

    segments: list[dict] = []
    transcript_lines: list[str] = []

    for index, raw_segment in enumerate(segments_iter):
        text = (raw_segment.text or "").strip()
        if not text:
            continue
        start_time = float(raw_segment.start or 0.0)
        end_time = float(raw_segment.end or start_time)
        segments.append(
            {
                "segmentIndex": index,
                "startTime": round(start_time, 3),
                "endTime": round(end_time, 3),
                "text": text,
            }
        )
        transcript_lines.append(text)

    transcript_text = "\n".join(transcript_lines).strip()
    duration_sec = ffprobe_duration(audio_path)
    if duration_sec is None and segments:
        duration_sec = float(segments[-1]["endTime"])

    files = write_sidecar_files(output_dir, segments, transcript_text)

    payload = {
        "language": getattr(info, "language", None),
        "durationSec": round(duration_sec, 3) if duration_sec is not None else None,
        "segmentCount": len(segments),
        "transcriptText": transcript_text,
        "segments": segments,
        "files": files,
    }
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
