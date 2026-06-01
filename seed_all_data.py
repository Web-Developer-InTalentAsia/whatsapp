"""
Seed all data: leave balances, leave requests, payroll periods+payslips,
attendance records, public holidays.
"""
import random, uuid, sys
from datetime import date, timedelta, datetime

CID = "3e8d750e-7313-4fd8-af82-a619a7609522"
TODAY = date.today()

LEAVE_TYPES = [
    ("e709473c-c133-4731-8817-fa1a97414811", "AL",  "Annual Leave",    21, True),
    ("e962300a-defb-4780-9033-9d26e31ec594", "CL",  "Casual Leave",     7, False),
    ("af096aca-0df3-4c0d-b2fa-4efd701f2800", "MAT", "Maternity Leave", 84, False),
    ("8328b578-9fc8-4935-a417-d72d6b2cd65d", "ML",  "Medical Leave",   14, False),
]

PAY_PERIODS = [
    ("87e1522d-b15e-46a1-bf4f-e4d8ac971589", 2026, 2, "February 2026", "CALCULATED"),
    ("1b5cb429-265a-4ffb-8166-6980a5f81d8a", 2026, 5, "May 2026",      "CALCULATED"),
    ("8bc05c08-9b28-4dc5-91c1-50593097cd2a", 2026, 6, "June 2026",     "CALCULATED"),
]

lines = ["BEGIN;"]

# ── 1. Public holidays ─────────────────────────────────────────────────────────
print("Generating public holidays…", file=sys.stderr)
HOLIDAYS = [
    ("Thai Pongal",              "2026-01-14", True),
    ("Independence Day",         "2026-02-04", True),
    ("Maha Sivarathri",          "2026-02-26", False),
    ("Milad un-Nabi",            "2026-03-20", False),
    ("Sinhala New Year Eve",     "2026-04-13", True),
    ("Sinhala & Tamil New Year", "2026-04-14", True),
    ("May Day",                  "2026-05-01", True),
    ("Vesak Full Moon Poya",     "2026-05-13", False),
    ("Poson Full Moon Poya",     "2026-06-11", False),
    ("Nikini Full Moon Poya",    "2026-08-08", False),
    ("Binara Full Moon Poya",    "2026-09-07", False),
    ("Vap Full Moon Poya",       "2026-10-06", False),
    ("Ill Full Moon Poya",       "2026-11-05", False),
    ("Christmas Day",            "2026-12-25", True),
    ("Unduvap Full Moon Poya",   "2026-12-04", False),
]
for name, dt, recurring in HOLIDAYS:
    hid = str(uuid.uuid4())
    lines.append(
        f"INSERT INTO public_holidays (id,company_id,name,holiday_date,is_paid,is_recurring,created_at) "
        f"VALUES ('{hid}','{CID}','{name}','{dt}',true,{str(recurring).lower()},NOW()) ON CONFLICT DO NOTHING;"
    )

# ── 2. Leave balances for ALL employees ───────────────────────────────────────
print("Generating leave balances…", file=sys.stderr)
lines.append("""
DO $$
DECLARE
  emp RECORD;
  lt_id TEXT;
  lt_days INT;
  lt_carry BOOLEAN;
  used NUMERIC;
  carry NUMERIC;
  pending NUMERIC;
BEGIN
""")

for lt_id, code, name, days, carry_fwd in LEAVE_TYPES:
    lines.append(f"""
  -- {name}
  FOR emp IN SELECT id, employment_type FROM employees WHERE company_id='{CID}' LOOP
    -- Skip maternity for random male employees (rough 50%)
    IF '{code}' = 'MAT' AND random() > 0.5 THEN CONTINUE; END IF;

    -- Interns get less leave
    IF emp.employment_type = 'INTERN' THEN
      lt_days := GREATEST(1, {days} / 3);
    ELSE
      lt_days := {days};
    END IF;

    used    := FLOOR(random() * (lt_days * 0.6));
    carry   := CASE WHEN {str(carry_fwd).lower()} THEN FLOOR(random() * 4) ELSE 0 END;
    pending := FLOOR(random() * 2);

    INSERT INTO leave_balances (id, employee_id, leave_type_id, year, entitled_days, used_days, carried_forward, pending_days)
    VALUES (gen_random_uuid()::text, emp.id, '{lt_id}', 2026, lt_days, used, carry, pending)
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  END LOOP;
""")

lines.append("END $$;")

# ── 3. Leave requests (~2000) ─────────────────────────────────────────────────
print("Generating leave requests…", file=sys.stderr)
STATUSES = (
    ["PENDING"]*25 + ["APPROVED"]*55 + ["REJECTED"]*12 + ["CANCELLED"]*8
)
REASONS = [
    "Family emergency requiring my presence at home.",
    "Medical appointment and recovery.",
    "Annual family vacation trip.",
    "Attending a relative's wedding ceremony.",
    "Personal matters that need immediate attention.",
    "Traveling for leisure and rest.",
    "Sick with fever and flu symptoms.",
    "Child's school event and parent meeting.",
    "Home renovation work requiring supervision.",
    "Religious observance and ceremony.",
    "Medical treatment and follow-up checkup.",
    "Visiting family in outstation.",
    None,
]

lines.append("""
DO $$
DECLARE
  emp_ids TEXT[];
  emp_id TEXT;
  lt_id TEXT;
  lt_days INT;
  status_val TEXT;
  start_d DATE;
  end_d DATE;
  days_req NUMERIC;
  reason TEXT;
  i INT;
BEGIN
  -- Pick random 2000 employees
  SELECT array_agg(id) INTO emp_ids FROM (
    SELECT id FROM employees WHERE company_id='""" + CID + """'
    ORDER BY random() LIMIT 2000
  ) sub;

  FOR i IN 1..array_length(emp_ids, 1) LOOP
    emp_id := emp_ids[i];
""")

# Status choices
STATUS_SQL = "CASE FLOOR(random()*100)::int WHEN <= 24 THEN 'PENDING' WHEN <= 79 THEN 'APPROVED' WHEN <= 91 THEN 'REJECTED' ELSE 'CANCELLED' END"

for lt_id, code, name, days, _ in LEAVE_TYPES:
    lines.append(f"""
    -- {name} requests
    IF random() > 0.6 THEN
      start_d := DATE '2026-01-01' + FLOOR(random() * 150)::int;
      lt_days := CASE WHEN '{code}'='AL' THEN (1 + FLOOR(random()*5))::int
                      WHEN '{code}'='CL' THEN 1
                      WHEN '{code}'='ML' THEN (1 + FLOOR(random()*7))::int
                      ELSE (1 + FLOOR(random()*3))::int END;
      end_d   := start_d + lt_days - 1;

      INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at)
      VALUES (
        gen_random_uuid()::text, emp_id, '{lt_id}', start_d, end_d, lt_days,
        (ARRAY['Family emergency.','Medical appointment.','Annual vacation.','Personal matter.',
               'Attending wedding.','Sick with fever.','Home renovation.',NULL])[FLOOR(random()*8+1)::int],
        (ARRAY['PENDING','PENDING','APPROVED','APPROVED','APPROVED','APPROVED','APPROVED',
               'REJECTED','CANCELLED'])[FLOOR(random()*9+1)::int]::"leavestatus",
        NOW() - (FLOOR(random()*90) || ' days')::interval
      ) ON CONFLICT DO NOTHING;
    END IF;
""")

lines.append("  END LOOP;\nEND $$;")

# ── 4. Payroll periods Jan–May 2026 (add missing months) ───────────────────────
print("Generating payroll periods…", file=sys.stderr)
MONTHS = [
    (2026, 1, "January 2026",  "2026-01-01", "2026-01-31"),
    (2026, 3, "March 2026",    "2026-03-01", "2026-03-31"),
    (2026, 4, "April 2026",    "2026-04-01", "2026-04-30"),
]
PERIOD_IDS = {}
for yr, mo, pname, ps, pe in MONTHS:
    pid = str(uuid.uuid4())
    PERIOD_IDS[f"{yr}-{mo:02d}"] = pid
    lines.append(
        f"INSERT INTO payroll_periods (id,company_id,year,month,period_name,period_start,period_end,status,created_at) "
        f"VALUES ('{pid}','{CID}',{yr},{mo},'{pname}','{ps}','{pe}','CALCULATED',NOW()) ON CONFLICT DO NOTHING;"
    )
# Add existing periods to map too
PERIOD_IDS["2026-02"] = "87e1522d-b15e-46a1-bf4f-e4d8ac971589"
PERIOD_IDS["2026-05"] = "1b5cb429-265a-4ffb-8166-6980a5f81d8a"
PERIOD_IDS["2026-06"] = "8bc05c08-9b28-4dc5-91c1-50593097cd2a"

# ── 5. Payslips for all employees for May & June 2026 ─────────────────────────
print("Generating payslips…", file=sys.stderr)
for period_key, period_id in [("2026-05", PERIOD_IDS["2026-05"]), ("2026-06", PERIOD_IDS["2026-06"])]:
    yr, mo = period_key.split("-")
    lines.append(f"""
DO $$
DECLARE
  emp RECORD;
  gross NUMERIC;
  epf_e NUMERIC;
  epf_er NUMERIC;
  etf NUMERIC;
  apit NUMERIC;
  ot NUMERIC;
  transport NUMERIC;
  meal NUMERIC;
  net NUMERIC;
BEGIN
  FOR emp IN SELECT id, basic_salary, employment_type, is_epf_applicable, is_etf_applicable
             FROM employees WHERE company_id='{CID}' AND is_active=true LOOP

    ot        := ROUND((random() * emp.basic_salary * 0.15)::numeric, 2);
    transport := ROUND((2500 + random() * 3000)::numeric, 2);
    meal      := ROUND((1000 + random() * 2000)::numeric, 2);
    gross     := emp.basic_salary + ot + transport + meal;

    epf_e  := CASE WHEN emp.is_epf_applicable THEN ROUND((gross * 0.08)::numeric, 2) ELSE 0 END;
    epf_er := CASE WHEN emp.is_epf_applicable THEN ROUND((gross * 0.12)::numeric, 2) ELSE 0 END;
    etf    := CASE WHEN emp.is_etf_applicable THEN ROUND((gross * 0.03)::numeric, 2) ELSE 0 END;
    apit   := CASE WHEN gross * 12 > 1200000 THEN ROUND(((gross*12 - 1200000) * 0.06 / 12)::numeric, 2) ELSE 0 END;
    net    := gross - epf_e - apit;

    INSERT INTO payslips (
      id, company_id, employee_id, payroll_period_id,
      year, month, gross_salary, basic_salary, epf_employee, epf_employer,
      etf_employer, apit_tax, net_salary, status, created_at
    ) VALUES (
      gen_random_uuid()::text, '{CID}', emp.id, '{period_id}',
      {yr}, {mo}, gross, emp.basic_salary, epf_e, epf_er,
      etf, apit, net, 'CONFIRMED', NOW()
    ) ON CONFLICT (employee_id, payroll_period_id) DO NOTHING;
  END LOOP;
END $$;
""")

# ── 6. Attendance records — last 90 days ──────────────────────────────────────
print("Generating attendance records…", file=sys.stderr)
lines.append(f"""
DO $$
DECLARE
  emp RECORD;
  d DATE;
  check_in TIME;
  check_out TIME;
  dow INT;
BEGIN
  FOR emp IN SELECT id FROM employees WHERE company_id='{CID}' AND is_active=true
             ORDER BY random() LIMIT 500 LOOP
    -- 3 months of attendance
    FOR d IN SELECT generate_series(CURRENT_DATE - 90, CURRENT_DATE - 1, '1 day'::interval)::date LOOP
      dow := EXTRACT(DOW FROM d);
      IF dow IN (0,6) THEN CONTINUE; END IF;  -- skip weekends
      IF random() < 0.08 THEN CONTINUE; END IF;  -- 8% absent

      -- Late arrivals (~15%)
      check_in  := CASE WHEN random() < 0.15
                   THEN ('08:' || LPAD((31 + FLOOR(random()*29))::text,2,'0') || ':00')::time
                   ELSE ('08:0' || FLOOR(random()*3)::text || ':00')::time END;
      check_out := ('17:' || LPAD((FLOOR(random()*90))::text,2,'0') || ':00')::time;

      INSERT INTO attendance_records (
        id, company_id, employee_id, date, check_in, check_out,
        work_minutes, status, created_at
      ) VALUES (
        gen_random_uuid()::text, '{CID}', emp.id, d,
        (d + check_in)::timestamp with time zone,
        (d + check_out)::timestamp with time zone,
        EXTRACT(EPOCH FROM (check_out - check_in))/60,
        'VALIDATED', NOW()
      ) ON CONFLICT (employee_id, date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
""")

lines.append("COMMIT;")
lines.append("SELECT 'leave_balances', COUNT(*) FROM leave_balances;")
lines.append("SELECT 'leave_requests', COUNT(*) FROM leave_requests;")
lines.append("SELECT 'payslips', COUNT(*) FROM payslips WHERE company_id='" + CID + "';")
lines.append("SELECT 'attendance_records', COUNT(*) FROM attendance_records WHERE company_id='" + CID + "';")
lines.append("SELECT 'public_holidays', COUNT(*) FROM public_holidays WHERE company_id='" + CID + "';")

print("\n".join(lines))
print("Done!", file=sys.stderr)
