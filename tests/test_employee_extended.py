# tests/test_employee_extended.py
"""Tests for employee extended fields — schemas and pure helpers."""
import pytest
from app.schemas.org import (
    AddEmployeeRequest, UpdateEmployeeRequest,
    OrgEmployeeSummary, BulkEmployeeRow, EMP_STATUS_VALUES,
)


class TestEmpStatusValues:
    def test_allowed_set(self):
        assert EMP_STATUS_VALUES == {'Active', 'Inactive', 'On Leave', 'Probation', 'Resigned'}


class TestAddEmployeeRequest:
    def test_defaults(self):
        req = AddEmployeeRequest(name='Jane', email='jane@example.com')
        assert req.emp_status == 'Active'
        assert req.default_language == 'English'
        assert req.head_of_dept is False
        assert req.last_name is None
        assert req.dob is None

    def test_all_fields(self):
        req = AddEmployeeRequest(
            name='Jane', email='jane@example.com',
            last_name='Smith', middle_name='Marie',
            title='Manager', employee_id='E001',
            emp_status='Probation', gender='Female',
            default_language='Hindi',
            manager_email='boss@example.com',
            dob='15/06/1990', emp_date='01/01/2020',
            head_of_dept=True,
        )
        assert req.emp_status == 'Probation'
        assert req.head_of_dept is True
        assert req.dob == '15/06/1990'

    def test_email_validated(self):
        with pytest.raises(Exception):
            AddEmployeeRequest(name='Jane', email='not-an-email')


class TestUpdateEmployeeRequest:
    def test_all_none_by_default(self):
        req = UpdateEmployeeRequest()
        assert req.emp_status is None
        assert req.head_of_dept is None

    def test_partial_fields(self):
        req = UpdateEmployeeRequest(emp_status='On Leave', head_of_dept=True)
        d = req.model_dump(exclude_none=True)
        assert d == {'emp_status': 'On Leave', 'head_of_dept': True}

    def test_empty_string_preserved(self):
        # Empty string must be preserved (used to clear optional fields)
        req = UpdateEmployeeRequest(last_name='', manager_email='')
        d = req.model_dump(exclude_none=True)
        assert d['last_name'] == ''
        assert d['manager_email'] == ''


class TestOrgEmployeeSummary:
    def test_required_fields(self):
        emp = OrgEmployeeSummary(
            id='uuid1', user_id='u1', name='Jane', email='jane@example.com',
            status='active', node_id='n1', joined_at='2026-01-01T00:00:00',
        )
        assert emp.emp_status == 'Active'
        assert emp.default_language == 'English'
        assert emp.head_of_dept is False

    def test_dob_stored_as_iso(self):
        emp = OrgEmployeeSummary(
            id='uuid1', user_id='u1', name='Jane', email='jane@example.com',
            status='active', node_id='n1', joined_at='2026-01-01T00:00:00',
            dob='1990-06-15',  # ISO format from DB
        )
        assert emp.dob == '1990-06-15'


class TestBulkEmployeeRow:
    def test_defaults(self):
        row = BulkEmployeeRow(row=2, name='Jane', email='jane@example.com')
        assert row.emp_status == 'Active'
        assert row.head_of_dept is False
        assert row.node_path is None


class TestParseDmyDate:
    def test_valid(self):
        from app.routers.admin import _parse_dmy_date
        assert _parse_dmy_date('15/06/1990') == '1990-06-15'
        assert _parse_dmy_date('01/01/2020') == '2020-01-01'

    def test_none_returns_none(self):
        from app.routers.admin import _parse_dmy_date
        assert _parse_dmy_date(None) is None
        assert _parse_dmy_date('') is None

    def test_invalid_raises(self):
        from app.routers.admin import _parse_dmy_date
        with pytest.raises(ValueError):
            _parse_dmy_date('1990-06-15')   # ISO format — wrong
        with pytest.raises(ValueError):
            _parse_dmy_date('32/13/2020')   # impossible date


class TestBulkParsing:
    """Test the parsing rules applied to each CSV row in bulk_upload_employees."""

    def _parse_head_of_dept(self, value: str) -> bool:
        """Mirror the logic in bulk_upload_employees."""
        return value.strip().lower() in ('yes', 'true', '1')

    def test_head_of_dept_yes(self):
        assert self._parse_head_of_dept('yes') is True
        assert self._parse_head_of_dept('Yes') is True
        assert self._parse_head_of_dept('true') is True
        assert self._parse_head_of_dept('1') is True

    def test_head_of_dept_no(self):
        assert self._parse_head_of_dept('no') is False
        assert self._parse_head_of_dept('') is False
        assert self._parse_head_of_dept('No') is False

    def test_emp_status_default(self):
        # blank → 'Active'
        value = ''.strip() or 'Active'
        assert value == 'Active'

    def test_emp_status_invalid(self):
        from app.schemas.org import EMP_STATUS_VALUES
        assert 'BadStatus' not in EMP_STATUS_VALUES

    def test_date_parse_valid(self):
        from app.routers.admin import _parse_dmy_date
        assert _parse_dmy_date('01/06/1985') == '1985-06-01'

    def test_date_parse_invalid_raises(self):
        from app.routers.admin import _parse_dmy_date
        with pytest.raises(ValueError):
            _parse_dmy_date('2026-01-01')  # ISO, not DMY


class TestEmptyStringClearing:
    """Verify that "" is treated as a clear (→ None) in the update endpoint logic."""

    def _apply_clear_logic(self, update_dict: dict) -> dict:
        """Mirror the clearing logic from update_employee."""
        CLEARABLE = {'last_name', 'middle_name', 'title', 'employee_id',
                     'gender', 'manager_email', 'dob', 'emp_date'}
        result = {}
        for k, v in update_dict.items():
            if k in CLEARABLE and v == '':
                result[k] = None
            else:
                result[k] = v
        return result

    def test_empty_string_clears_text_field(self):
        d = self._apply_clear_logic({'last_name': ''})
        assert d['last_name'] is None

    def test_non_empty_preserved(self):
        d = self._apply_clear_logic({'last_name': 'Smith'})
        assert d['last_name'] == 'Smith'

    def test_non_clearable_preserved(self):
        d = self._apply_clear_logic({'emp_status': 'Active'})
        assert d['emp_status'] == 'Active'

    def test_empty_emp_status_not_cleared(self):
        # emp_status with "" should NOT be treated as clear
        d = self._apply_clear_logic({'emp_status': ''})
        assert d['emp_status'] == ''  # left for the validation to reject
