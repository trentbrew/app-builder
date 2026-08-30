"""
Why `onChunk` measured the wrong thing.

Renders the TTFT bug documented in ../app_builder_run_envelope.md §5: the naive
handler stamped time-to-first-token on the stream's first *control* part, not its
first *generated* part, reporting 5 ms on a 16.8 s turn.

Render (no LaTeX required — Pango Text only):

    .venv-manim/bin/manim -qh \
        --media_dir docs/artifacts/animations/media \
        docs/artifacts/animations/ttft_bug.py TtftBug
"""

import numpy as np
from manim import *

# manim 0.21 exposes LEFT/RIGHT/UP/DOWN as plain sequences, so `LEFT * 6.2`
# raises TypeError. Use explicit vectors wherever a direction is scaled.
VU = np.array([0.0, 1.0, 0.0])
VD = np.array([0.0, -1.0, 0.0])

CONTROL = "#6b7280"  # grey — stream scaffolding
CONTENT = "#22c55e"  # green — generated tokens
CONTROL_FILL = "#1a1f2b"
CONTENT_FILL = "#123021"
WRONG = "#ef4444"
GOOD = "#22c55e"
INK = "#e5e7eb"
DIM = "#9ca3af"

# Named explicitly: manim's default face is a serif that collapses spaces in
# Pango ("on a16,770 ms turn"). Both are verified present via manimpango.list_fonts().
MONO = "Menlo"
SANS = "Helvetica"

TRACK_Y = 1.0
BOX_W = 1.18
BOX_H = 0.46

# (label, x on the track, is_generated_content)
PARTS = [
    ("start", -5.95, False),
    ("start-step", -4.70, False),
    ("text-delta", -1.15, True),
    ("text-delta", 0.10, True),
    ("text-delta", 1.35, True),
    ("text-end", 2.60, False),
    ("finish", 3.85, False),
]


class TtftBug(Scene):
    def construct(self):
        self.camera.background_color = "#0b0f19"

        # ---- title ------------------------------------------------------------
        title = Text("Time to first token", font_size=44, color=INK, font=SANS)
        subtitle = Text(
            "what the stream actually delivers",
            font_size=24,
            color=DIM,
            font=SANS,
        ).next_to(title, DOWN, buff=0.25)
        self.play(FadeIn(title, shift=VD * 0.3), run_time=0.6)
        self.play(FadeIn(subtitle), run_time=0.4)
        self.wait(0.7)
        self.play(
            VGroup(title, subtitle).animate.scale(0.5).to_edge(UP, buff=0.3),
            run_time=0.7,
        )

        # ---- the stream track -------------------------------------------------
        track = Line(
            [-6.65, TRACK_Y, 0], [4.55, TRACK_Y, 0], color=DIM, stroke_width=2
        ).set_z_index(0)
        self.play(Create(track), run_time=0.6)

        # ---- parts arrive -----------------------------------------------------
        boxes = {}
        for i, (label, x, is_content) in enumerate(PARTS):
            color = CONTENT if is_content else CONTROL
            fill = CONTENT_FILL if is_content else CONTROL_FILL
            box = Rectangle(
                width=BOX_W,
                height=BOX_H,
                color=color,
                fill_color=fill,
                fill_opacity=1.0,
                stroke_width=2,
            ).move_to([x, TRACK_Y, 0])
            text = Text(label, font_size=14, color=INK, font=MONO).move_to(
                box.get_center()
            )
            # z_index above the track so the line does not strike through labels.
            boxes[i] = VGroup(box, text).set_z_index(2)

            # The pause before the first generated token IS the latency.
            if i == 2:
                thinking = Text(
                    "model is generating…",
                    font_size=21,
                    color=DIM,
                    slant=ITALIC,
                    font=SANS,
                ).move_to([-3.0, TRACK_Y, 0])
                self.play(FadeIn(thinking), run_time=0.4)
                self.wait(1.4)
                self.play(FadeOut(thinking), run_time=0.3)

            self.play(FadeIn(boxes[i], shift=VD * 0.2), run_time=0.26)

        legend = (
            VGroup(
                VGroup(
                    Square(0.17, color=CONTROL, fill_color=CONTROL, fill_opacity=0.5),
                    Text("control part", font_size=18, color=DIM, font=SANS),
                ).arrange(RIGHT, buff=0.18),
                VGroup(
                    Square(0.17, color=CONTENT, fill_color=CONTENT, fill_opacity=0.5),
                    Text("generated token", font_size=18, color=DIM, font=SANS),
                ).arrange(RIGHT, buff=0.18),
            )
            .arrange(RIGHT, buff=0.9)
            .move_to([0, TRACK_Y + 0.9, 0])
        )
        self.play(FadeIn(legend), run_time=0.5)
        self.wait(0.8)

        # ---- the naive handler ------------------------------------------------
        code_wrong = (
            VGroup(
                Text("onChunk: () => {", font_size=20, color=INK, font=MONO),
                Text(
                    "  if (first === null) first = Date.now()",
                    font_size=20,
                    color=WRONG,
                    font=MONO,
                ),
                Text("}", font_size=20, color=INK, font=MONO),
            )
            .arrange(DOWN, aligned_edge=LEFT, buff=0.14)
            .move_to([0.2, -1.55, 0])
        )
        self.play(FadeIn(code_wrong), run_time=0.5)

        arrow_wrong = Arrow(
            [PARTS[0][1], TRACK_Y - 0.95, 0],
            [PARTS[0][1], TRACK_Y - 0.30, 0],
            color=WRONG,
            buff=0,
            stroke_width=5,
            max_tip_length_to_length_ratio=0.35,
        )
        label_wrong = Text(
            "ttft = 5 ms", font_size=26, color=WRONG, font=MONO
        ).next_to(arrow_wrong, DOWN, buff=0.18)
        self.play(GrowArrow(arrow_wrong), FadeIn(label_wrong), run_time=0.5)
        self.play(Indicate(boxes[0], color=WRONG, scale_factor=1.18), run_time=0.6)

        verdict_wrong = Text(
            "this is stream setup, not generation",
            font_size=24,
            color=WRONG,
            font=SANS,
        ).move_to([0.2, -2.85, 0])
        self.play(FadeIn(verdict_wrong), run_time=0.5)
        self.wait(1.6)

        # ---- the fix ----------------------------------------------------------
        self.play(
            FadeOut(verdict_wrong),
            FadeOut(arrow_wrong),
            FadeOut(label_wrong),
            run_time=0.4,
        )

        code_right = (
            VGroup(
                Text("onChunk: ({ chunk }) => {", font_size=20, color=INK, font=MONO),
                Text(
                    "  if (chunk.type !== 'text-delta' &&",
                    font_size=20,
                    color=GOOD,
                    font=MONO,
                ),
                Text(
                    "      chunk.type !== 'reasoning-delta') return",
                    font_size=20,
                    color=GOOD,
                    font=MONO,
                ),
                Text(
                    "  if (first === null) first = Date.now()",
                    font_size=20,
                    color=INK,
                    font=MONO,
                ),
                Text("}", font_size=20, color=INK, font=MONO),
            )
            .arrange(DOWN, aligned_edge=LEFT, buff=0.14)
            .move_to([0.2, -1.65, 0])
        )
        self.play(FadeOut(code_wrong), FadeIn(code_right), run_time=0.6)

        # control parts recede; only generated tokens still count
        self.play(
            *[
                boxes[i].animate.set_opacity(0.25)
                for i, (_, _, c) in enumerate(PARTS)
                if not c
            ],
            run_time=0.5,
        )

        arrow_right = Arrow(
            [PARTS[2][1], TRACK_Y - 0.95, 0],
            [PARTS[2][1], TRACK_Y - 0.30, 0],
            color=GOOD,
            buff=0,
            stroke_width=5,
            max_tip_length_to_length_ratio=0.35,
        )
        label_right = Text(
            "ttft = 372 ms", font_size=26, color=GOOD, font=MONO
        ).next_to(arrow_right, DOWN, buff=0.18)
        self.play(GrowArrow(arrow_right), FadeIn(label_right), run_time=0.5)
        self.play(Indicate(boxes[2], color=GOOD, scale_factor=1.18), run_time=0.6)
        self.wait(1.8)

        # ---- the lesson -------------------------------------------------------
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)

        before = VGroup(
            Text("before", font_size=22, color=DIM, font=SANS),
            Text("5 ms", font_size=56, color=WRONG, font=MONO),
            Text("on a 16,770 ms turn", font_size=20, color=DIM, font=SANS),
        ).arrange(DOWN, buff=0.22)
        after = VGroup(
            Text("after", font_size=22, color=DIM, font=SANS),
            Text("372 ms", font_size=56, color=GOOD, font=MONO),
            Text("on a 4,688 ms turn", font_size=20, color=DIM, font=SANS),
        ).arrange(DOWN, buff=0.22)
        pair = VGroup(before, after).arrange(RIGHT, buff=2.4).move_to([0, 1.5, 0])
        self.play(FadeIn(pair, shift=VU * 0.2), run_time=0.7)
        self.wait(1.2)

        lesson = (
            VGroup(
                Text(
                    "It never threw. It never warned. It was always plausible.",
                    font_size=27,
                    color=INK,
                    font=SANS,
                ),
                Text(
                    "A green build proves the code ran —",
                    font_size=27,
                    color=DIM,
                    font=SANS,
                ),
                Text(
                    "only a real run proves the measurement means anything.",
                    font_size=27,
                    color=CONTENT,
                    font=SANS,
                ),
            )
            .arrange(DOWN, buff=0.30)
            .move_to([0, -1.4, 0])
        )
        for line in lesson:
            self.play(FadeIn(line), run_time=0.5)
        self.wait(2.4)
