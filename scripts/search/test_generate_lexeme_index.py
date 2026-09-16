#!/usr/bin/env python3
"""
Tests for the folding rules the lexeme index is built on.

Run with:  python3 -m pytest scripts/search/test_generate_lexeme_index.py

normalize() here and normalizeHebrewForSearch() in src/search.ts must fold
Hebrew identically. If they drift, the index keys and the lookups spell words
differently, so the lookup silently misses and search falls back to whole-word
matching. Both read folding-cases.json; the TypeScript half is in
src/__tests__/unit/search-lexeme-index.test.ts.
"""

import importlib.util
import json
import os

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))


def _load_generator():
    """Import the generator by path, since its filename is hyphenated."""
    path = os.path.join(HERE, "generate-lexeme-index.py")
    spec = importlib.util.spec_from_file_location("generate_lexeme_index", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


normalize = _load_generator().normalize

with open(os.path.join(HERE, "folding-cases.json"), encoding="utf-8") as handle:
    CASES = json.load(handle)


@pytest.mark.parametrize("case", CASES, ids=[case["rule"] for case in CASES])
def test_folding_case(case):
    assert normalize(case["in"]) == case["out"]


def test_none_is_safe():
    # Only Python can be handed None; BHSA returns it for an absent feature.
    assert normalize(None) == ""
