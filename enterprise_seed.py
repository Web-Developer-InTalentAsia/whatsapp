"""
enterprise_seed.py
Generate PostgreSQL seed SQL for Paylix enterprise demo data.
Creates 2 new companies: Ultra Super (50 emp) + Dialog Axiata (500 emp).
Usage: python enterprise_seed.py | psql -U paylix -d paylix
"""
import sys
import random
import calendar
from datetime import date, timedelta, datetime

# Force UTF-8 stdout on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

random.seed(42)  # reproducible

# ─── Constants ────────────────────────────────────────────────────────────────
INTALENT_ID   = "3e8d750e-7313-4fd8-af82-a619a7609522"
ULTRA_ID      = "a1b2c3d4-0001-0001-0001-000000000001"
DIALOG_ID     = "a1b2c3d4-0002-0002-0002-000000000002"
PW_HASH       = "$2b$12$gv5ZSpalCtHvjsSLauiuYur0KQ0x0Nz9dFUFD6mSwjYdt3v9J4216"  # Admin@1234

FIRST_M = ["Kamal","Nimal","Ruwan","Lasith","Chaminda","Dinesh","Pradeep","Saman","Roshan","Ajith",
           "Mahesh","Dilshan","Kasun","Thilak","Nuwan","Sanjeewa","Asanka","Buddhika","Chathura","Dilan",
           "Eranga","Gayan","Harsha","Isuru","Janaka","Kapila","Lahiru","Madusanka","Naveen","Oshan",
           "Pasan","Ruchira","Supun","Thilina","Udara","Vimukthi","Wimal","Yasith","Amila","Binara",
           "Chanaka","Dasun","Eshan","Gamini","Hasitha","Indika","Jayantha","Kumara","Lakshman","Madura",
           "Nilantha","Pathum","Rathna","Sachith","Tharindu","Uditha","Vasitha","Wickrama","Yohan","Ashan"]
FIRST_F = ["Priya","Sandya","Nadeeka","Chamari","Dilhani","Rashmi","Thilini","Anusha","Malika","Niluka",
           "Kumari","Sriyani","Roshani","Amara","Buddhini","Chathurika","Deepika","Erandi","Gayani",
           "Hiruni","Ishani","Jayani","Kavindi","Lakshmi","Manjula","Nawoda","Oshadhi","Piyumi","Ruwini",
           "Sachini","Tharushi","Udayangani","Vasana","Waruni","Yasodha","Ashini","Bhagya","Chandani",
           "Dilini","Gimhani","Hansani","Inoka","Jayamali","Kishani","Lakmali","Maheshi","Naduni","Oneli",
           "Pavithra","Ridma","Surangi","Thisari","Upeksha","Vimansa","Wathsala","Zainab","Imasha","Geetha"]
LAST = ["Perera","Silva","Fernando","Rajapaksha","Bandara","Wickramasinghe","Jayasinghe","Dissanayake",
        "Gunasekara","Herath","Karunaratne","Liyanage","Navaratne","Peiris","Ratnayake","Samarasinghe",
        "Tennakoon","Udawatta","Vithanage","Weerasekara","Yatawara","Zoysa","Abeysekera","Balasuriya",
        "Chathuranga","Dasanayake","Edirisuriya","Fonseka","Gamage","Halwatura","Illeperuma","Jayalath",
        "Kulatunga","Lokuge","Madanayake","Nanayakkara","Pathirana","Ranasinghe","Subasinghe",
        "Thilakarathna","Udugama","Vidanapathirana","Wijethunga","Amarasinghe","Dharmaratne","Ekanayake",
        "Galagoda","Haputhanthri","Jayawardena","Liyanarachchi","Mahipala","Niroshan","Chandrasekara"]
BANKS   = ["BOC","HNB","Sampath","Commercial","NDB","Seylan","NSB","DFCC","Pan Asia","Hatton National"]
CITIES  = ["Colombo","Kandy","Galle","Negombo","Matara","Kurunegala","Anuradhapura","Ratnapura","Badulla","Jaffna"]
BRANCHES= ["Main","City","Nugegoda","Pettah","Maradana","Bambalapitiya","Dehiwala","Borella","Boralesgamuwa","Kirulapone"]

def q(s):
    return str(s).replace("'","''")

def uid(prefix=""):
    """Generate a deterministic-ish UUID placeholder using random."""
    import uuid
    return str(uuid.uuid4())

def rand_name(gender):
    if gender == "M":
        return random.choice(FIRST_M) + " " + random.choice(LAST)
    return random.choice(FIRST_F) + " " + random.choice(LAST)

def rand_nic(dob: date, gender: str):
    yy = str(dob.year)[2:]
    day_of_year = dob.timetuple().tm_yday
    if gender == "F":
        day_of_year += 500
    serial = random.randint(100, 999)
    check  = random.randint(0, 9)
    if dob.year >= 2000:
        return f"{dob.year}{day_of_year:03d}{serial:04d}V"
    return f"{yy}{day_of_year:03d}{serial}{check}V"

def rand_mobile():
    prefixes = ["071","072","075","076","077","078"]
    return random.choice(prefixes) + str(random.randint(1000000, 9999999))

def rand_bank_acct():
    return str(random.randint(1000000000, 9999999999))

def rand_epf():
    return f"EPF{random.randint(100000, 999999)}"

def sqlbool(b):
    return "true" if b else "false"

def p(s=""):
    print(s)

# ─── Name pools for emails ────────────────────────────────────────────────────
def email_from_name(name, domain, idx):
    parts = name.lower().split()
    base  = parts[0] + "." + parts[-1] if len(parts) > 1 else parts[0]
    base  = base.replace("'","")
    return f"{base}{idx}@{domain}"

# ─── Employment type distribution ─────────────────────────────────────────────
EMP_TYPES_POOL = (
    ["INTERN"] * 15 +
    ["PROBATION"] * 10 +
    ["PERMANENT"] * 55 +
    ["CONTRACT"] * 15 +
    ["PART_TIME"] * 5
)
SALARY_RANGE = {
    "INTERN":    (18000,  35000),
    "PROBATION": (40000,  65000),
    "CONTRACT":  (50000, 150000),
    "PERMANENT": (60000, 400000),
    "PART_TIME": (30000,  80000),
}

# ─── Pre-built UUID registries ────────────────────────────────────────────────
import uuid as _uuid

def mkuuid():
    return str(_uuid.uuid4())

# ══════════════════════════════════════════════════════════════════════════════
# Builder functions
# ══════════════════════════════════════════════════════════════════════════════

def build_company_block(cid, code, name, legal, reg, epf_reg, etf_reg, addr, phone, email_co, schema):
    p(f"""INSERT INTO companies (id,code,name,legal_name,reg_number,epf_reg_number,etf_reg_number,
  address,phone,email,db_schema,is_active,settings,created_at,updated_at) VALUES (
  '{cid}','{code}','{q(name)}','{q(legal)}','{reg}','{epf_reg}','{etf_reg}',
  '{q(addr)}','{phone}','{email_co}','{schema}',
  true,'{{}}',NOW()-INTERVAL '2 years',NOW()
) ON CONFLICT (id) DO NOTHING;""")

def build_departments(cid, dept_list):
    """dept_list: [(uid, code, name), ...]  Returns list of (uid, code, name)"""
    rows = []
    for did, code, name in dept_list:
        rows.append(f"  ('{did}','{cid}','{code}','{q(name)}',NULL,NULL,'CC-{code}',true,NOW()-INTERVAL '2 years')")
    p("INSERT INTO departments (id,company_id,code,name,parent_id,manager_id,cost_center,is_active,created_at) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")

def build_designations(cid, desig_list):
    """desig_list: [(uid, code, name, grade), ...]"""
    rows = []
    for did, code, name, grade in desig_list:
        rows.append(f"  ('{did}','{cid}','{code}','{q(name)}','{grade}',true)")
    p("INSERT INTO designations (id,company_id,code,name,grade,is_active) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")

def build_shifts(cid, shift_list):
    rows = []
    for sid, name, st, en, gi, go, ot in shift_list:
        rows.append(f"  ('{sid}','{cid}','{q(name)}','{st}','{en}',{gi},{go},{ot},true)")
    p("INSERT INTO shift_schedules (id,company_id,name,start_time,end_time,grace_in_min,grace_out_min,ot_threshold_min,is_active) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")

def build_salary_components(cid, comp_list):
    rows = []
    for i, (sid, code, name, ctype, taxable, epf, fixed, order_) in enumerate(comp_list):
        rows.append(
            f"  ('{sid}','{cid}','{code}','{q(name)}','{ctype}',{sqlbool(taxable)},{sqlbool(epf)},{sqlbool(fixed)},{order_},true,NOW()-INTERVAL '2 years')"
        )
    p("INSERT INTO salary_components (id,company_id,code,name,component_type,is_taxable,is_epf_liable,is_fixed,display_order,is_active,created_at) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")

def build_payroll_rules(cid):
    rules = [
        ("EPF_EMPLOYEE_RATE","EPF Employee Rate","8","percent","Employee EPF contribution 8%"),
        ("EPF_EMPLOYER_RATE","EPF Employer Rate","12","percent","Employer EPF contribution 12%"),
        ("ETF_EMPLOYER_RATE","ETF Employer Rate","3","percent","Employer ETF contribution 3%"),
        ("OT_MULTIPLIER","OT Multiplier","1.5","number","Overtime pay multiplier"),
        ("HOLIDAY_OT_MULTIPLIER","Holiday OT Multiplier","2.0","number","Holiday overtime multiplier"),
        ("WORKING_DAYS_PER_MONTH","Working Days Per Month","26","number","Standard working days"),
    ]
    rows = []
    for key, rname, val, vtype, desc in rules:
        rows.append(
            f"  (gen_random_uuid()::text,'{cid}','{key}','{rname}','{val}','{vtype}','{desc}','2025-01-01',true,NOW())"
        )
    p("INSERT INTO payroll_rules (id,company_id,rule_key,rule_name,rule_value,value_type,description,effective_from,is_active,created_at) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")

def build_public_holidays(cid):
    holidays = [
        ("Thai Pongal",              "2025-01-14", True),
        ("Independence Day",         "2025-02-04", True),
        ("Maha Sivarathri",          "2025-02-26", True),
        ("Sinhala New Year Eve",     "2025-04-13", True),
        ("Sinhala & Tamil New Year", "2025-04-14", True),
        ("May Day",                  "2025-05-01", True),
        ("Vesak Full Moon Poya",     "2025-05-12", True),
        ("Thai Pongal",              "2026-01-14", True),
        ("Independence Day",         "2026-02-04", True),
        ("Sinhala & Tamil New Year", "2026-04-14", True),
        ("May Day",                  "2026-05-01", True),
    ]
    rows = []
    for name, hdate, paid in holidays:
        rows.append(
            f"  (gen_random_uuid()::text,'{cid}','{q(name)}','{hdate}',{sqlbool(paid)},true,NOW())"
        )
    p("INSERT INTO public_holidays (id,company_id,name,holiday_date,is_paid,is_recurring,created_at) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")

def build_leave_types(cid):
    """Returns list of (uid, code)"""
    lt = [
        (mkuuid(),"AL","Annual Leave",        21, True, 10, True,  False, False),
        (mkuuid(),"CL","Casual Leave",         7, False, 0, True,  False, False),
        (mkuuid(),"ML","Medical Leave",       14, False, 0, True,  True,  True),
        (mkuuid(),"MAT","Maternity Leave",    84, False, 0, True,  False, True),
    ]
    rows = []
    for lid, code, name, days, cf, maxcf, paid, medical, doc in lt:
        rows.append(
            f"  ('{lid}','{cid}','{code}','{name}',{days},{sqlbool(cf)},{maxcf},{sqlbool(paid)},{sqlbool(medical)},{sqlbool(doc)},true)"
        )
    p("INSERT INTO leave_types (id,company_id,code,name,days_entitled,is_carry_forward,max_carry_days,is_paid,is_medical,requires_document,is_active) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")
    return [(r[0], r[1]) for r in lt]  # (uid, code)

def build_hikvision_devices(cid, short):
    rows = []
    for i in range(1, 3):
        did = mkuuid()
        rows.append(
            f"  ('{did}','{cid}','DS{short}{i:03d}','{short} Gate {i}','192.168.{i}.100',8000,'admin','enc_pass_{i}','Main Entrance {i}',true,true,true,NOW()-INTERVAL '1 month',NOW())"
        )
    p("INSERT INTO hikvision_devices (id,company_id,device_serial,device_name,ip_address,port,username,password_enc,location,is_entry,is_exit,is_active,last_sync_at,created_at) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")

def user_row(uid, cid, email, name, role, emp_id, interval):
    eid_sql = f"'{emp_id}'" if emp_id else "NULL"
    return (
        "  ('{uid}','{cid}','{email}','{pw}','{name}','{role}'::\"userrole\",{eid},"
        "false,true,false,0,NOW()-INTERVAL '{iv}',NOW())"
    ).format(uid=uid, cid=cid, email=email, pw=PW_HASH, name=q(name),
             role=role, eid=eid_sql, iv=interval)

def build_users(cid, domain, admin_uid, hr_uid, fin_uid, sup1_uid, sup2_uid, emp_uids, emp_records):
    """emp_records: list of (uid, full_name)"""
    rows = []
    rows.append(user_row(admin_uid, cid, f"admin@{domain}", "Company Admin", "CLIENT_ADMIN", None, "2 years"))
    rows.append(user_row(hr_uid,    cid, f"hr@{domain}",    "HR Manager",    "HR_USER",      None, "2 years"))
    rows.append(user_row(fin_uid,   cid, f"finance@{domain}", "Finance Officer", "FINANCE_USER", None, "2 years"))
    rows.append(user_row(sup1_uid,  cid, f"supervisor1@{domain}", "Supervisor One", "SUPERVISOR", None, "2 years"))
    rows.append(user_row(sup2_uid,  cid, f"supervisor2@{domain}", "Supervisor Two", "SUPERVISOR", None, "2 years"))
    for i, (euid, full_name) in enumerate(emp_records[:20]):
        em = email_from_name(full_name, domain, i+1)
        rows.append(
            "  (gen_random_uuid()::text,'{cid}','{email}','{pw}','{name}','EMPLOYEE'::\"userrole\",'{eid}',false,true,false,0,NOW()-INTERVAL '1 year',NOW())".format(
                cid=cid, email=em, pw=PW_HASH, name=q(full_name), eid=euid
            )
        )
    p("INSERT INTO users (id,company_id,email,hashed_password,full_name,role,employee_id,totp_enabled,is_active,must_change_pw,failed_login_count,created_at,updated_at) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT (email) DO NOTHING;")

def gen_employees(cid, code, count, dept_ids, desig_ids, sup1_uid, sup2_uid, domain):
    """
    Returns list of dicts with employee data.
    Uses DO $$ block to insert via PL/pgSQL loop for large sets.
    """
    employees = []
    resigned_count = max(1, int(count * 0.05))
    base_join = date(2020, 1, 1)

    for i in range(1, count + 1):
        gender      = "F" if random.random() < 0.30 else "M"
        full_name   = rand_name(gender)
        emp_num     = f"EMP{i:03d}"
        dob         = date(random.randint(1975, 2000), random.randint(1, 12), random.randint(1, 28))
        nic         = rand_nic(dob, gender)
        emp_type    = random.choice(EMP_TYPES_POOL)
        sal_lo, sal_hi = SALARY_RANGE[emp_type]
        basic       = round(random.randint(sal_lo, sal_hi) / 1000) * 1000
        join_days   = random.randint(0, 5 * 365)
        join_date   = base_join + timedelta(days=join_days)
        if join_date > date(2026, 5, 1):
            join_date = date(2026, 5, 1)
        confirm     = (join_date + timedelta(days=90)) if emp_type == "PROBATION" else None
        is_active   = True
        resign_date = None
        lwdate      = None
        if i <= resigned_count:
            is_active   = False
            resign_date = date(2024, random.randint(1, 12), random.randint(1, 28))
            lwdate      = resign_date + timedelta(days=30)
        dept_id     = random.choice(dept_ids)
        desig_id    = random.choice(desig_ids)
        mobile      = rand_mobile()
        bank        = random.choice(BANKS)
        branch      = random.choice(BRANCHES)
        acct        = rand_bank_acct()
        epf_num     = rand_epf()
        city        = random.choice(CITIES)
        addr        = f"No.{random.randint(1,200)}, {city} Road, {city}"
        email_emp   = email_from_name(full_name, domain, i)
        tax_code    = f"TABLE_0{random.randint(1,5)}"
        supervisor  = sup1_uid if i % 2 == 0 else sup2_uid
        uid_        = mkuuid()

        employees.append({
            "uid": uid_, "emp_num": emp_num, "full_name": full_name,
            "gender": gender, "dob": dob.isoformat(), "nic": nic,
            "emp_type": emp_type, "basic": basic,
            "join_date": join_date.isoformat(),
            "confirm": confirm.isoformat() if confirm else None,
            "resign": resign_date.isoformat() if resign_date else None,
            "lwd": lwdate.isoformat() if lwdate else None,
            "is_active": is_active,
            "dept_id": dept_id, "desig_id": desig_id,
            "email": email_emp, "mobile": mobile,
            "addr": addr, "bank": bank, "branch": branch, "acct": acct,
            "epf_num": epf_num, "tax_code": tax_code,
            "supervisor": supervisor, "company_id": cid,
        })
    return employees

def insert_employees_sql(emp_list):
    """Emit INSERT rows in batches of 50."""
    BATCH = 50
    for start in range(0, len(emp_list), BATCH):
        batch = emp_list[start:start+BATCH]
        rows  = []
        for e in batch:
            confirm_sql = f"'{e['confirm']}'" if e['confirm'] else "NULL"
            resign_sql  = f"'{e['resign']}'"  if e['resign']  else "NULL"
            lwd_sql     = f"'{e['lwd']}'"     if e['lwd']     else "NULL"
            etype_cast = "'" + e['emp_type'] + "'::\"employmenttype\""
            pref = q(e['full_name'].split()[0])
            gdr  = 'M' if e['gender'] == 'M' else 'F'
            rows.append(
                "  ('{uid}','{cid}','{enum}','{fn}','{pn}','{nic}','{dob}','{g}','{em}','{mob}','{addr}','{did}','{dgid}',{etype},'{jd}',{conf},{res},{lwd},{act},{sal},'{epf}',true,true,'{tax}','{bnk}','{brn}','{acct}','{sup}',NOW()-INTERVAL '1 year',NOW())".format(
                    uid=e['uid'], cid=e['company_id'], enum=e['emp_num'], fn=q(e['full_name']),
                    pn=pref, nic=e['nic'], dob=e['dob'], g=gdr, em=e['email'], mob=e['mobile'],
                    addr=q(e['addr']), did=e['dept_id'], dgid=e['desig_id'], etype=etype_cast,
                    jd=e['join_date'], conf=confirm_sql, res=resign_sql, lwd=lwd_sql,
                    act=sqlbool(e['is_active']), sal=e['basic'], epf=e['epf_num'],
                    tax=e['tax_code'], bnk=e['bank'], brn=e['branch'], acct=e['acct'],
                    sup=e['supervisor']
                )
            )
        p("INSERT INTO employees (id,company_id,employee_number,full_name,preferred_name,nic_number,date_of_birth,gender,email,mobile,address,department_id,designation_id,employment_type,join_date,confirmation_date,resignation_date,last_working_date,is_active,basic_salary,epf_number,is_epf_applicable,is_etf_applicable,tax_table_code,bank_name,bank_branch,bank_account_number,supervisor_id,created_at,updated_at) VALUES")
        p(",\n".join(rows))
        p("ON CONFLICT DO NOTHING;")

def build_salary_component_assignments(emp_list, comp_ids):
    """comp_ids: [transport_id, meal_id, mobile_id, loan_id, perf_id]"""
    transport_id, meal_id, mobile_id, loan_id, perf_id = comp_ids
    rows = []
    for e in emp_list:
        if not e["is_active"]:
            continue
        transport_amt = random.randint(3000, 8000)
        meal_amt      = random.randint(1500, 4000)
        mobile_amt    = random.randint(500, 3000) if random.random() > 0.4 else 0
        loan_amt      = random.randint(5000, 25000) if random.random() > 0.7 else 0
        perf_amt      = round(e["basic"] * random.uniform(0.05, 0.2)) if random.random() > 0.6 else 0

        for comp_id, amt in [(transport_id, transport_amt),(meal_id, meal_amt),(mobile_id, mobile_amt),(loan_id, loan_amt),(perf_id, perf_amt)]:
            if amt > 0:
                rows.append(
                    f"  (gen_random_uuid()::text,'{e['uid']}','{comp_id}',{amt},'2025-01-01',NULL,true)"
                )
        if len(rows) >= 200:
            p("INSERT INTO employee_salary_components (id,employee_id,component_id,amount,effective_from,effective_to,is_active) VALUES")
            p(",\n".join(rows))
            p("ON CONFLICT DO NOTHING;")
            rows = []
    if rows:
        p("INSERT INTO employee_salary_components (id,employee_id,component_id,amount,effective_from,effective_to,is_active) VALUES")
        p(",\n".join(rows))
        p("ON CONFLICT DO NOTHING;")

def build_payroll_periods(cid):
    """Returns list of (uid, year, month, status)"""
    periods = []
    # Jun 2025 - May 2026 = 12 months
    months = []
    y, m = 2025, 6
    for _ in range(12):
        months.append((y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1

    for idx, (year, month) in enumerate(months):
        uid_  = mkuuid()
        # last 2 are not COMPLETED
        if idx >= 10:
            status = "DRAFT" if idx == 11 else "HR_REVIEW"
        else:
            status = "COMPLETED"
        last_day = calendar.monthrange(year, month)[1]
        sdate = date(year, month, 1)
        edate = date(year, month, last_day)
        periods.append({
            "uid": uid_, "year": year, "month": month,
            "name": f"{sdate.strftime('%B %Y')} Payroll",
            "start": sdate.isoformat(), "end": edate.isoformat(),
            "status": status, "working_days": 26,
        })
    rows = []
    for p_ in periods:
        rows.append(
            f"  ('{p_['uid']}','{cid}',{p_['year']},{p_['month']},'{q(p_['name'])}','{p_['start']}','{p_['end']}','{p_['status']}',{p_['working_days']},NOW()-INTERVAL '1 year',NOW())"
        )
    p("INSERT INTO payroll_periods (id,company_id,year,month,period_name,start_date,end_date,status,working_days,created_at,updated_at) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")
    return periods

def build_payslips(emp_list, periods, comp_ids):
    """Generate payslips for active employees x all periods."""
    transport_id, meal_id, mobile_id, loan_id, perf_id = comp_ids
    rows = []

    def flush():
        if rows:
            p("INSERT INTO payslips (id,period_id,employee_id,company_id,working_days,present_days,absent_days,no_pay_days,leave_days,ot_hours,basic_salary,gross_salary,total_allowances,ot_amount,no_pay_deduction,epf_employee,epf_employer,etf_employer,apit,total_deductions,net_salary,earnings_detail,deductions_detail,tax_table_used,is_released,computed_at,created_at,updated_at) VALUES")
            p(",\n".join(rows))
            p("ON CONFLICT (employee_id, period_id) DO NOTHING;")
            rows.clear()

    active_emps = [e for e in emp_list if e["is_active"]]
    for e in active_emps:
        for per in periods:
            present   = random.randint(22, 26)
            absent    = 26 - present
            leave_d   = random.randint(0, min(3, absent))
            no_pay_d  = max(0, absent - leave_d)
            ot_hours  = round(random.uniform(0, 20), 1) if random.random() > 0.7 else 0
            transport = random.randint(3000, 8000)
            meal      = random.randint(1500, 4000)
            ot_amount = round(e["basic"] / 26 / 8 * 1.5 * ot_hours) if ot_hours > 0 else 0
            total_allow = transport + meal
            gross     = e["basic"] + total_allow + ot_amount
            epf_emp   = round(gross * 0.08) if True else 0
            epf_er    = round(gross * 0.12)
            etf       = round(gross * 0.03)
            annual    = gross * 12
            apit      = round(max(0, (annual - 1200000) * 0.06 / 12)) if annual > 1200000 else 0
            npd       = round(e["basic"] / 26 * no_pay_d)
            total_ded = epf_emp + apit + npd
            net       = gross - total_ded
            is_rel    = per["status"] == "COMPLETED"

            earn_json = f'{{"basic":{e["basic"]},"transport":{transport},"meal":{meal},"ot_amount":{ot_amount}}}'
            ded_json  = f'{{"epf_employee":{epf_emp},"apit":{apit},"no_pay_deduction":{npd}}}'

            rows.append(
                f"  (gen_random_uuid()::text,'{per['uid']}','{e['uid']}','{e['company_id']}',26,{present},{absent},{no_pay_d},{leave_d},{ot_hours},{e['basic']},{gross},{total_allow},{ot_amount},{npd},{epf_emp},{epf_er},{etf},{apit},{total_ded},{net},$ESC${earn_json}$ESC$,$ESC${ded_json}$ESC$,'01',{sqlbool(is_rel)},NOW()-INTERVAL '20 days',NOW()-INTERVAL '20 days',NOW())"
            )
            if len(rows) >= 100:
                flush()
    flush()

def build_attendance(emp_list, cid):
    """6 months Jan-Jun 2026, Mon-Fri only."""
    rows = []

    def flush():
        if rows:
            p("INSERT INTO attendance_records (id,employee_id,company_id,work_date,check_in,check_out,check_in_source,check_out_source,raw_minutes,ot_minutes,is_absent,is_half_day,is_holiday,is_approved,approved_by,notes,created_at,updated_at) VALUES")
            p(",\n".join(rows))
            p("ON CONFLICT (employee_id, work_date) DO NOTHING;")
            rows.clear()

    active_emps = [e for e in emp_list if e["is_active"]]
    start = date(2026, 1, 1)
    end   = date(2026, 6, 30)
    workdays = []
    d = start
    while d <= end:
        if d.weekday() < 5:  # Mon-Fri
            workdays.append(d)
        d += timedelta(days=1)

    for e in active_emps:
        for wd in workdays:
            is_absent = random.random() < 0.08
            is_late   = (not is_absent) and random.random() < 0.12
            is_ot     = (not is_absent) and random.random() < 0.05
            source    = "HIKVISION" if random.random() < 0.70 else "MANUAL"

            if is_absent:
                rows.append(
                    f"  (gen_random_uuid()::text,'{e['uid']}','{cid}','{wd.isoformat()}',NULL,NULL,'{source}','{source}',0,0,true,false,false,true,NULL,NULL,NOW(),NOW())"
                )
            else:
                ci_h, ci_m = 8, random.randint(15, 45) if is_late else random.randint(0, 10)
                co_h = 17 + (random.randint(0, 2) if is_ot else 0)
                co_m = random.randint(0, 59)
                ot_min = (co_h - 17) * 60 + co_m if is_ot else 0
                raw   = (co_h - ci_h) * 60 + (co_m - ci_m)
                ci_ts = f"{wd.isoformat()} {ci_h:02d}:{ci_m:02d}:00+05:30"
                co_ts = f"{wd.isoformat()} {co_h:02d}:{co_m:02d}:00+05:30"
                rows.append(
                    f"  (gen_random_uuid()::text,'{e['uid']}','{cid}','{wd.isoformat()}','{ci_ts}','{co_ts}','{source}','{source}',{raw},{ot_min},false,false,false,true,NULL,NULL,NOW(),NOW())"
                )
            if len(rows) >= 200:
                flush()
    flush()

def build_leave_balances(emp_list, leave_type_ids):
    """leave_type_ids: list of (uid, code)"""
    rows = []

    def flush():
        if rows:
            p("INSERT INTO leave_balances (id,employee_id,leave_type_id,year,entitled_days,used_days,pending_days,carried_forward) VALUES")
            p(",\n".join(rows))
            p("ON CONFLICT DO NOTHING;")
            rows.clear()

    for e in emp_list:
        if not e["is_active"]:
            continue
        for lt_id, lt_code in leave_type_ids:
            entitled  = 21 if lt_code == "AL" else (7 if lt_code == "CL" else (14 if lt_code == "ML" else 84))
            if e["emp_type"] == "INTERN" and lt_code == "AL":
                entitled = 7
            used      = random.randint(0, min(5, entitled))
            pending   = random.randint(0, 2)
            carried   = random.randint(0, 5) if lt_code == "AL" else 0
            rows.append(
                f"  (gen_random_uuid()::text,'{e['uid']}','{lt_id}',2026,{entitled},{used},{pending},{carried})"
            )
        if len(rows) >= 200:
            flush()
    flush()

def build_leave_requests(emp_list, leave_type_ids, count):
    """Generate `count` leave requests."""
    STATUSES = (
        ["APPROVED"] * 50 +
        ["PENDING"]  * 20 +
        ["REJECTED"] * 15 +
        ["CANCELLED"]* 15
    )
    active_emps = [e for e in emp_list if e["is_active"]]
    lt_ids = [x[0] for x in leave_type_ids]
    rows = []
    for i in range(count):
        e         = random.choice(active_emps)
        lt_id     = random.choice(lt_ids)
        status    = random.choice(STATUSES)
        sdate     = date(2026, random.randint(1, 5), random.randint(1, 28))
        days      = random.randint(1, 5)
        edate     = sdate + timedelta(days=days - 1)
        reason    = random.choice(["Personal","Medical appointment","Family event","Travel","Rest"])
        days_ago = random.randint(1, 60)
        rows.append(
            "  (gen_random_uuid()::text,'{eid}','{ltid}','{sd}','{ed}',{d},'{r}','{st}'::\"leavestatus\",NOW()-INTERVAL '{da} days')".format(
                eid=e['uid'], ltid=lt_id, sd=sdate.isoformat(), ed=edate.isoformat(),
                d=days, r=reason, st=status, da=days_ago
            )
        )
    p("INSERT INTO leave_requests (id,employee_id,leave_type_id,start_date,end_date,total_days,reason,status,created_at) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")

def build_audit_logs(cid, admin_uid):
    ACTIONS = ["LOGIN_SUCCESS","EMPLOYEE_CREATED","PAYROLL_CALCULATED","PAYSLIP_RELEASED",
               "LEAVE_APPROVED","ATTENDANCE_UPDATED","USER_CREATED","SETTINGS_UPDATED",
               "REPORT_GENERATED","LOGOUT"]
    RESOURCES = ["employee","payroll","leave","attendance","user","company","report"]
    rows = []
    for i in range(100):
        action   = random.choice(ACTIONS)
        resource = random.choice(RESOURCES)
        ip       = f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
        rows.append(
            f"  (gen_random_uuid()::text,'{cid}','{admin_uid}','admin@company.lk','{action}','{resource}',gen_random_uuid()::text,'{{}}','{ip}','Mozilla/5.0',NOW()-INTERVAL '{random.randint(1,365)} days')"
        )
    p("INSERT INTO audit_logs (id,company_id,user_id,user_email,action,resource_type,resource_id,payload,ip_address,user_agent,created_at) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")

def build_notifications(cid, admin_uid):
    TITLES = ["Payroll Completed","Leave Request Approved","Attendance Alert",
              "New Payslip Available","Pending Approvals","System Update","Reminder"]
    BODIES = ["Your payroll has been processed.","Your leave request has been approved.",
              "Attendance discrepancy detected.","Your payslip for this month is ready.",
              "You have pending approval requests.","System maintenance scheduled.",
              "Action required: please review."]
    NTYPES = ["payroll_complete","leave_approved","attendance_alert","payslip_ready","reminder","system"]
    rows = []
    for i in range(50):
        title = random.choice(TITLES)
        body  = random.choice(BODIES)
        ntype = random.choice(NTYPES)
        rows.append(
            f"  (gen_random_uuid()::text,'{admin_uid}','{cid}','{title}','{body}','{ntype}',gen_random_uuid()::text,false,NOW()-INTERVAL '{random.randint(1,30)} days')"
        )
    p("INSERT INTO notifications (id,user_id,company_id,title,body,ntype,ref_id,is_read,created_at) VALUES")
    p(",\n".join(rows))
    p("ON CONFLICT DO NOTHING;")

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    p("-- ============================================================")
    p("-- Paylix Enterprise Demo Seed -- Ultra Super + Dialog Axiata")
    p("-- ============================================================")
    p()
    p("\\echo 'Starting enterprise seed...'")
    p()
    p("BEGIN;")
    p()

    # ── Pre-built IDs ──────────────────────────────────────────────────────────
    # Ultra Super
    US_ADMIN_UID = mkuuid(); US_HR_UID = mkuuid(); US_FIN_UID = mkuuid()
    US_SUP1_UID  = mkuuid(); US_SUP2_UID = mkuuid()

    us_dept_list = [
        (mkuuid(), "IT",   "Information Technology"),
        (mkuuid(), "HR",   "Human Resources"),
        (mkuuid(), "FIN",  "Finance"),
        (mkuuid(), "SAL",  "Sales"),
        (mkuuid(), "OPS",  "Operations"),
        (mkuuid(), "ENG",  "Engineering"),
    ]
    us_desig_list = [
        (mkuuid(), "CEO",   "Chief Executive Officer",  "E1"),
        (mkuuid(), "DIR",   "Director",                 "E2"),
        (mkuuid(), "GM",    "General Manager",          "M1"),
        (mkuuid(), "SM",    "Senior Manager",           "M2"),
        (mkuuid(), "MGR",   "Manager",                  "M3"),
        (mkuuid(), "AM",    "Assistant Manager",        "M4"),
        (mkuuid(), "SE",    "Senior Executive",         "S1"),
        (mkuuid(), "EXE",   "Executive",                "S2"),
        (mkuuid(), "JE",    "Junior Executive",         "S3"),
        (mkuuid(), "INT",   "Intern",                   "S4"),
    ]
    us_shift_list = [
        (mkuuid(), "Day Shift",   "08:00", "17:00", 15, 15, 480),
        (mkuuid(), "Night Shift", "20:00", "05:00", 15, 15, 480),
        (mkuuid(), "General",     "09:00", "18:00", 15, 15, 480),
    ]
    us_comp_list = [
        (mkuuid(), "TRANSPORT",  "Transport Allowance", "earning",    False, False, True,  1),
        (mkuuid(), "MEAL",       "Meal Allowance",      "earning",    False, False, True,  2),
        (mkuuid(), "MOBILE",     "Mobile Allowance",    "earning",    True,  False, True,  3),
        (mkuuid(), "LOAN_DED",   "Loan Deduction",      "deduction",  False, False, True,  4),
        (mkuuid(), "PERF_BONUS", "Performance Bonus",   "earning",    True,  True,  False, 5),
    ]

    # Dialog Axiata
    DG_ADMIN_UID = mkuuid(); DG_HR_UID = mkuuid(); DG_FIN_UID = mkuuid()
    DG_SUP1_UID  = mkuuid(); DG_SUP2_UID = mkuuid()

    dg_dept_list = [
        (mkuuid(), "IT",   "Information Technology"),
        (mkuuid(), "HR",   "Human Resources"),
        (mkuuid(), "FIN",  "Finance"),
        (mkuuid(), "SAL",  "Sales"),
        (mkuuid(), "MKT",  "Marketing"),
        (mkuuid(), "CC",   "Customer Care"),
        (mkuuid(), "NET",  "Network"),
        (mkuuid(), "LEG",  "Legal"),
        (mkuuid(), "OPS",  "Operations"),
        (mkuuid(), "ENG",  "Engineering"),
    ]
    dg_desig_list = [
        (mkuuid(), "CEO",   "Chief Executive Officer",  "E1"),
        (mkuuid(), "DIR",   "Director",                 "E2"),
        (mkuuid(), "GM",    "General Manager",          "M1"),
        (mkuuid(), "SM",    "Senior Manager",           "M2"),
        (mkuuid(), "MGR",   "Manager",                  "M3"),
        (mkuuid(), "AM",    "Assistant Manager",        "M4"),
        (mkuuid(), "SE",    "Senior Executive",         "S1"),
        (mkuuid(), "EXE",   "Executive",                "S2"),
        (mkuuid(), "JE",    "Junior Executive",         "S3"),
        (mkuuid(), "INT",   "Intern",                   "S4"),
    ]
    dg_shift_list = [
        (mkuuid(), "Day Shift",   "08:00", "17:00", 15, 15, 480),
        (mkuuid(), "Night Shift", "20:00", "05:00", 15, 15, 480),
        (mkuuid(), "General",     "09:00", "18:00", 15, 15, 480),
    ]
    dg_comp_list = [
        (mkuuid(), "TRANSPORT",  "Transport Allowance", "earning",    False, False, True,  1),
        (mkuuid(), "MEAL",       "Meal Allowance",      "earning",    False, False, True,  2),
        (mkuuid(), "MOBILE",     "Mobile Allowance",    "earning",    True,  False, True,  3),
        (mkuuid(), "LOAN_DED",   "Loan Deduction",      "deduction",  False, False, True,  4),
        (mkuuid(), "PERF_BONUS", "Performance Bonus",   "earning",    True,  True,  False, 5),
    ]

    # ═══════════════════════════════
    # ULTRA SUPER (Pvt) Ltd
    # ═══════════════════════════════
    p("-- -----------------------------------------------")
    p("-- ULTRA SUPER (Pvt) Ltd")
    p("-- -----------------------------------------------")
    p()

    p("\\echo 'Creating Ultra Super company...'")
    build_company_block(
        ULTRA_ID, "ULTRASUPER", "Ultra Super (Pvt) Ltd", "Ultra Super (Private) Limited",
        "PV/123456/2020", "EPF/US/001", "ETF/US/001",
        "No.45, Duplication Road, Colombo 03", "0112345678",
        "info@ultrasuper.lk", "ultrasuper"
    )
    p()

    p("\\echo 'Ultra Super: Departments...'")
    build_departments(ULTRA_ID, us_dept_list)
    p()

    p("\\echo 'Ultra Super: Designations...'")
    build_designations(ULTRA_ID, us_desig_list)
    p()

    p("\\echo 'Ultra Super: Shifts...'")
    build_shifts(ULTRA_ID, us_shift_list)
    p()

    p("\\echo 'Ultra Super: Salary components...'")
    build_salary_components(ULTRA_ID, us_comp_list)
    p()

    p("\\echo 'Ultra Super: Payroll rules...'")
    build_payroll_rules(ULTRA_ID)
    p()

    p("\\echo 'Ultra Super: Public holidays...'")
    build_public_holidays(ULTRA_ID)
    p()

    p("\\echo 'Ultra Super: Leave types...'")
    us_leave_types = build_leave_types(ULTRA_ID)
    p()

    p("\\echo 'Ultra Super: Hikvision devices...'")
    build_hikvision_devices(ULTRA_ID, "US")
    p()

    p("\\echo 'Ultra Super: Generating employees...'")
    us_dept_ids  = [d[0] for d in us_dept_list]
    us_desig_ids = [d[0] for d in us_desig_list]
    us_comp_ids  = [c[0] for c in us_comp_list]
    us_employees = gen_employees(
        ULTRA_ID, "ULTRASUPER", 50,
        us_dept_ids, us_desig_ids,
        US_SUP1_UID, US_SUP2_UID, "ultrasuper.lk"
    )
    insert_employees_sql(us_employees)
    p()

    p("\\echo 'Ultra Super: Users...'")
    us_emp_records = [(e["uid"], e["full_name"]) for e in us_employees]
    build_users(ULTRA_ID, "ultrasuper.lk",
                US_ADMIN_UID, US_HR_UID, US_FIN_UID,
                US_SUP1_UID, US_SUP2_UID,
                [e["uid"] for e in us_employees], us_emp_records)
    p()

    p("\\echo 'Ultra Super: Salary component assignments...'")
    build_salary_component_assignments(us_employees, us_comp_ids)
    p()

    p("\\echo 'Ultra Super: Payroll periods...'")
    us_periods = build_payroll_periods(ULTRA_ID)
    p()

    p("\\echo 'Ultra Super: Payslips...'")
    build_payslips(us_employees, us_periods, us_comp_ids)
    p()

    p("\\echo 'Ultra Super: Attendance records...'")
    build_attendance(us_employees, ULTRA_ID)
    p()

    p("\\echo 'Ultra Super: Leave balances...'")
    build_leave_balances(us_employees, us_leave_types)
    p()

    p("\\echo 'Ultra Super: Leave requests...'")
    build_leave_requests(us_employees, us_leave_types, 50)
    p()

    p("\\echo 'Ultra Super: Audit logs...'")
    build_audit_logs(ULTRA_ID, US_ADMIN_UID)
    p()

    p("\\echo 'Ultra Super: Notifications...'")
    build_notifications(ULTRA_ID, US_ADMIN_UID)
    p()

    # ═══════════════════════════════
    # DIALOG AXIATA PLC
    # ═══════════════════════════════
    p("-- -----------------------------------------------")
    p("-- DIALOG AXIATA PLC")
    p("-- -----------------------------------------------")
    p()

    p("\\echo 'Creating Dialog Axiata company...'")
    build_company_block(
        DIALOG_ID, "DIALOG", "Dialog Axiata PLC", "Dialog Axiata Public Limited Company",
        "PQ/98765/2000", "EPF/DLG/001", "ETF/DLG/001",
        "475, Union Place, Colombo 02", "0777678000",
        "info@dialog.lk", "dialog"
    )
    p()

    p("\\echo 'Dialog: Departments...'")
    build_departments(DIALOG_ID, dg_dept_list)
    p()

    p("\\echo 'Dialog: Designations...'")
    build_designations(DIALOG_ID, dg_desig_list)
    p()

    p("\\echo 'Dialog: Shifts...'")
    build_shifts(DIALOG_ID, dg_shift_list)
    p()

    p("\\echo 'Dialog: Salary components...'")
    build_salary_components(DIALOG_ID, dg_comp_list)
    p()

    p("\\echo 'Dialog: Payroll rules...'")
    build_payroll_rules(DIALOG_ID)
    p()

    p("\\echo 'Dialog: Public holidays...'")
    build_public_holidays(DIALOG_ID)
    p()

    p("\\echo 'Dialog: Leave types...'")
    dg_leave_types = build_leave_types(DIALOG_ID)
    p()

    p("\\echo 'Dialog: Hikvision devices...'")
    build_hikvision_devices(DIALOG_ID, "DG")
    p()

    p("\\echo 'Dialog: Generating employees (500)...'")
    dg_dept_ids  = [d[0] for d in dg_dept_list]
    dg_desig_ids = [d[0] for d in dg_desig_list]
    dg_comp_ids  = [c[0] for c in dg_comp_list]
    dg_employees = gen_employees(
        DIALOG_ID, "DIALOG", 500,
        dg_dept_ids, dg_desig_ids,
        DG_SUP1_UID, DG_SUP2_UID, "dialog.lk"
    )
    insert_employees_sql(dg_employees)
    p()

    p("\\echo 'Dialog: Users...'")
    dg_emp_records = [(e["uid"], e["full_name"]) for e in dg_employees]
    build_users(DIALOG_ID, "dialog.lk",
                DG_ADMIN_UID, DG_HR_UID, DG_FIN_UID,
                DG_SUP1_UID, DG_SUP2_UID,
                [e["uid"] for e in dg_employees], dg_emp_records)
    p()

    p("\\echo 'Dialog: Salary component assignments...'")
    build_salary_component_assignments(dg_employees, dg_comp_ids)
    p()

    p("\\echo 'Dialog: Payroll periods...'")
    dg_periods = build_payroll_periods(DIALOG_ID)
    p()

    p("\\echo 'Dialog: Payslips (500 emp x 12 months)...'")
    build_payslips(dg_employees, dg_periods, dg_comp_ids)
    p()

    p("\\echo 'Dialog: Attendance records (6 months)...'")
    build_attendance(dg_employees, DIALOG_ID)
    p()

    p("\\echo 'Dialog: Leave balances...'")
    build_leave_balances(dg_employees, dg_leave_types)
    p()

    p("\\echo 'Dialog: Leave requests (300)...'")
    build_leave_requests(dg_employees, dg_leave_types, 300)
    p()

    p("\\echo 'Dialog: Audit logs...'")
    build_audit_logs(DIALOG_ID, DG_ADMIN_UID)
    p()

    p("\\echo 'Dialog: Notifications...'")
    build_notifications(DIALOG_ID, DG_ADMIN_UID)
    p()

    # ── Commit ─────────────────────────────────────────────────────────────────
    p("COMMIT;")
    p()
    p("\\echo ''")
    p("\\echo '========== SEED COMPLETE =========='")
    p()
    p("-- Summary counts")
    p("SELECT 'companies'        AS table_name, COUNT(*) FROM companies;")
    p("SELECT 'employees'        AS table_name, COUNT(*) FROM employees;")
    p("SELECT 'users'            AS table_name, COUNT(*) FROM users;")
    p("SELECT 'departments'      AS table_name, COUNT(*) FROM departments;")
    p("SELECT 'salary_components' AS table_name, COUNT(*) FROM salary_components;")
    p("SELECT 'payroll_periods'  AS table_name, COUNT(*) FROM payroll_periods;")
    p("SELECT 'payslips'         AS table_name, COUNT(*) FROM payslips;")
    p("SELECT 'attendance_records' AS table_name, COUNT(*) FROM attendance_records;")
    p("SELECT 'leave_balances'   AS table_name, COUNT(*) FROM leave_balances;")
    p("SELECT 'leave_requests'   AS table_name, COUNT(*) FROM leave_requests;")
    p("SELECT 'audit_logs'       AS table_name, COUNT(*) FROM audit_logs;")
    p("SELECT 'notifications'    AS table_name, COUNT(*) FROM notifications;")
    p()
    p("-- Company breakdown")
    p("SELECT c.name, COUNT(e.id) AS employees")
    p("FROM companies c")
    p("LEFT JOIN employees e ON e.company_id = c.id")
    p("GROUP BY c.name ORDER BY c.name;")


if __name__ == "__main__":
    main()
