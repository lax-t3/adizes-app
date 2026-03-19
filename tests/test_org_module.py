# tests/test_org_module.py
"""Tests for org module service helpers (pure functions, no DB)."""
import pytest


def _make_flat_nodes(specs):
    """Build flat org_nodes rows from list of (id, parent_id, path, name, is_root)."""
    return [
        {"id": id_, "parent_id": pid, "path": path,
         "name": name, "is_root": is_root,
         "org_id": "org1", "node_type": "department",
         "display_order": 0, "created_at": "2026-01-01T00:00:00"}
        for id_, pid, path, name, is_root in specs
    ]


class TestBuildOrgTree:
    def test_single_root(self):
        from app.routers.admin import _build_org_tree
        nodes = _make_flat_nodes([
            ("root1", None, "org1/root1", "Acme Corp", True),
        ])
        tree = _build_org_tree(nodes, employee_counts={})
        assert len(tree) == 1
        assert tree[0]["name"] == "Acme Corp"
        assert tree[0]["children"] == []

    def test_two_levels(self):
        from app.routers.admin import _build_org_tree
        nodes = _make_flat_nodes([
            ("root1", None,   "org1/root1",        "Acme Corp",    True),
            ("div1",  "root1","org1/root1/div1",   "North",        False),
            ("div2",  "root1","org1/root1/div2",   "South",        False),
        ])
        tree = _build_org_tree(nodes, employee_counts={"div1": 5, "div2": 3})
        assert len(tree[0]["children"]) == 2
        children_names = {c["name"] for c in tree[0]["children"]}
        assert children_names == {"North", "South"}
        north = next(c for c in tree[0]["children"] if c["name"] == "North")
        assert north["employee_count"] == 5

    def test_three_levels(self):
        from app.routers.admin import _build_org_tree
        nodes = _make_flat_nodes([
            ("root1", None,   "org1/root1",             "Acme Corp", True),
            ("div1",  "root1","org1/root1/div1",         "North",    False),
            ("dep1",  "div1", "org1/root1/div1/dep1",    "Sales",    False),
        ])
        tree = _build_org_tree(nodes, employee_counts={})
        north = tree[0]["children"][0]
        assert north["children"][0]["name"] == "Sales"


class TestResolveNodePath:
    def test_finds_by_name_chain(self):
        from app.routers.admin import _resolve_node_path
        nodes = _make_flat_nodes([
            ("root1", None,   "org1/root1",           "Acme Corp", True),
            ("div1",  "root1","org1/root1/div1",       "North",    False),
            ("dep1",  "div1", "org1/root1/div1/dep1",  "Sales",    False),
        ])
        result = _resolve_node_path("North/Sales", nodes)
        assert result == "dep1"

    def test_case_insensitive(self):
        from app.routers.admin import _resolve_node_path
        nodes = _make_flat_nodes([
            ("root1", None,   "org1/root1",           "Acme",  True),
            ("div1",  "root1","org1/root1/div1",       "north", False),
        ])
        assert _resolve_node_path("NORTH", nodes) == "div1"

    def test_not_found_returns_none(self):
        from app.routers.admin import _resolve_node_path
        nodes = _make_flat_nodes([
            ("root1", None, "org1/root1", "Acme", True),
        ])
        assert _resolve_node_path("Nonexistent", nodes) is None

    def test_empty_path_returns_none(self):
        from app.routers.admin import _resolve_node_path
        nodes = _make_flat_nodes([
            ("root1", None, "org1/root1", "Acme", True),
        ])
        assert _resolve_node_path("", nodes) is None
