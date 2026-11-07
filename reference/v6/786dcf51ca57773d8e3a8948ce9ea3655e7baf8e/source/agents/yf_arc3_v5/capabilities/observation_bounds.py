"""Mechanical envelope shared by action-packet transport and its consumers."""

MAX_ACTION_INTERMEDIATE_FRAMES = 128
MAX_ACTION_PACKET_FRAMES = MAX_ACTION_INTERMEDIATE_FRAMES + 1
# Retrospection also includes the observation immediately before the action.
MAX_ACTION_COMPARISON_FRAMES = MAX_ACTION_PACKET_FRAMES + 1
MAX_ACTION_PACKET_CELLS = 1_048_576
