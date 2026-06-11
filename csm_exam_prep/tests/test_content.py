from content.days import DAYS


def test_days_has_48_entries():
    assert len(DAYS) == 48


def test_each_day_has_required_keys():
    required = {"day", "title", "week", "phase", "topic", "estimated_minutes", "sections", "key_terms"}
    for d in DAYS:
        missing = required - d.keys()
        assert not missing, f"Day {d.get('day')} missing: {missing}"


def test_day_numbers_are_sequential():
    numbers = [d["day"] for d in DAYS]
    assert numbers == list(range(1, 49))


def test_each_day_has_at_least_one_section():
    for d in DAYS:
        assert len(d["sections"]) >= 1, f"Day {d['day']} has no sections"


def test_each_section_has_required_keys():
    for d in DAYS:
        for s in d["sections"]:
            assert "heading" in s, f"Day {d['day']} section missing 'heading'"
            assert "body" in s, f"Day {d['day']} section missing 'body'"
