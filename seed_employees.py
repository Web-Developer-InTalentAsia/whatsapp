"""
Seed 10,000 employees into Paylix DB.
Employment types: intern, permanent (normal), contract, executive, probation
Run: python3 seed_employees.py
"""
import asyncio, random, uuid
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql+asyncpg://paylix:changeme@db:5432/paylix"
COMPANY_ID   = "3e8d750e-7313-4fd8-af82-a619a7609522"

DEPARTMENTS = {
    "ENG": "872971d1-a1ec-484e-b91e-c9a389cf70fc",
    "FIN": "88b8e56f-e3ea-4276-928a-6f1cc12207d7",
    "HR":  "5f4bdfd3-ce83-4651-868b-6ad0fc901925",
    "IT":  "f8db93cc-73ca-4875-814a-781a063c33dc",
    "OPS": "93e4c007-1beb-40de-bdc6-095f05d09524",
    "SAL": "e06db144-e364-41a2-b71e-97e158125ec2",
}
DEPT_IDS = list(DEPARTMENTS.values())

# Sri Lankan first names
FIRST_NAMES_M = [
    "Kamal","Nimal","Ruwan","Lasith","Chaminda","Dinesh","Pradeep","Saman","Roshan","Ajith",
    "Mahesh","Dilshan","Kasun","Thilak","Nuwan","Sanjeewa","Asanka","Buddhika","Chathura","Dilan",
    "Eranga","Fabian","Gayan","Harsha","Isuru","Janaka","Kapila","Lahiru","Madusanka","Naveen",
    "Oshadha","Pasan","Ruchira","Supun","Thilina","Udara","Vimukthi","Wimal","Yasith","Zehan",
    "Amila","Binara","Chanaka","Dasun","Eshan","Gamini","Hiruni","Indika","Jayantha","Kumara",
    "Lakshman","Madura","Nilantha","Oshan","Pathum","Rathna","Sachith","Tharindu","Uditha","Vasitha",
    "Wickrama","Yohan","Zeeshan","Asel","Bimitha","Chanuka","Danushka","Erandhi","Fathima","Hasitha",
    "Ishan","Jayani","Kishara","Lakshan","Minura","Nadeesha","Oshan","Praveen","Ravindu","Sampath",
]
FIRST_NAMES_F = [
    "Priya","Sandya","Nadeeka","Chamari","Dilhani","Rashmi","Thilini","Anusha","Malika","Niluka",
    "Kumari","Sriyani","Roshani","Amara","Buddhini","Chathurika","Deepika","Erandi","Fathima","Gayani",
    "Hiruni","Ishani","Jayani","Kavindi","Lakshmi","Manjula","Nawoda","Oshadhi","Piyumi","Ruwini",
    "Sachini","Tharushi","Udayangani","Vasana","Waruni","Yasodha","Zainab","Achini","Binara","Chathuri",
    "Damayanthi","Eranga","Geetha","Hasini","Imasha","Janitha","Keshari","Lakmali","Maheshi","Naduni",
    "Oneli","Pavithra","Ridma","Surangi","Thisari","Upeksha","Vimansa","Wathsala","Yasitha","Zeenath",
    "Ashini","Bhagya","Chandani","Dilini","Erandhi","Fonseka","Gimhani","Hansani","Inoka","Jayamali",
]
LAST_NAMES = [
    "Perera","Silva","Fernando","Rajapaksha","Bandara","Wickramasinghe","Jayasinghe","Dissanayake",
    "Gunasekara","Herath","Karunaratne","Liyanage","Madushan","Navaratne","Obeyesekere","Peiris",
    "Ratnayake","Samarasinghe","Tennakoon","Udawatta","Vithanage","Weerasekara","Yatawara","Zoysa",
    "Abeysekera","Balasuriya","Chathuranga","Dasanayake","Edirisuriya","Fonseka","Gamage","Halwatura",
    "Illeperuma","Jayalath","Kulatunga","Lokuge","Madanayake","Nanayakkara","Opatha","Pathirana",
    "Ranasinghe","Subasinghe","Thilakarathna","Udugama","Vidanapathirana","Wijethunga","Yalegama",
    "Amarasinghe","Beligaswatta","Chandrasekara","Dharmaratne","Ekanayake","Galagoda","Haputhanthri",
    "Ingiriya","Jayawardena","Kusaladharma","Liyanarachchi","Mahipala","Niroshan","Ovitigala",
]
BANKS = ["BOC","HNB","Sampath","Commercial","NDB","Seylan","NSB","DFCC","Pan Asia","Hatton National"]
CITIES = ["Colombo","Kandy","Galle","Negombo","Matara","Kurunegala","Anuradhapura","Ratnapura","Badulla","Jaffna"]

# Employment type distribution: intern=15%, permanent=50%, contract=20%, probation=10%, executive=5%
EMP_TYPES = (
    ["intern"]*15 + ["permanent"]*50 + ["contract"]*20 + ["probation"]*10 + ["permanent"]*5  # last 5 = executive salary range
)

# Salary ranges by type
SALARY_RANGES = {
    "intern":    (18_000,  35_000),
    "probation": (40_000,  65_000),
    "contract":  (50_000,  120_000),
    "permanent": (60_000,  250_000),
    "part_time": (25_000,  50_000),
}
# Executives: permanent with high salary
EXECUTIVE_SALARY = (200_000, 600_000)

TAX_TABLES = ["01","02","03","04","05","06","07","08"]

INSERT_SQL = """
INSERT INTO employees (
    id, company_id, employee_number, full_name, email, mobile,
    department_id, employment_type, join_date, basic_salary,
    is_epf_applicable, is_etf_applicable, tax_table_code,
    bank_name, bank_branch, bank_account_number,
    nic_number, is_active, created_at, updated_at
) VALUES (
    :id, :company_id, :employee_number, :full_name, :email, :mobile,
    :department_id, :employment_type, :join_date, :basic_salary,
    :is_epf, :is_etf, :tax_table,
    :bank_name, :bank_branch, :bank_account,
    :nic, :is_active, NOW(), NOW()
) ON CONFLICT (employee_number) DO NOTHING;
"""

def gen_nic():
    year = random.randint(1975, 2004)
    day  = random.randint(1, 365)
    tail = random.randint(1000, 9999)
    if year >= 2000:
        return f"{year}{str(day).zfill(3)}{tail:04d}"
    else:
        v = random.choice(["V","X"])
        return f"{str(year)[-2:]}{str(day).zfill(3)}{tail:04d}{v}"

def gen_bank_account():
    return "".join([str(random.randint(0,9)) for _ in range(10)])

def gen_mobile():
    prefixes = ["071","072","075","076","077","078"]
    return random.choice(prefixes) + "".join([str(random.randint(0,9)) for _ in range(7)])

async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    from sqlalchemy import text

    BATCH = 500
    total = 10_000
    start_num = 4  # EMP001-EMP003 exist

    print(f"Seeding {total} employees in batches of {BATCH}…")

    async with async_session() as session:
        for batch_start in range(0, total, BATCH):
            batch_end = min(batch_start + BATCH, total)
            params_list = []

            for i in range(batch_start, batch_end):
                emp_num = start_num + i
                gender = random.choice(["M","F"])
                first  = random.choice(FIRST_NAMES_M if gender=="M" else FIRST_NAMES_F)
                last   = random.choice(LAST_NAMES)
                full_name = f"{first} {last}"
                email_user = f"{first.lower()}.{last.lower()}{emp_num}"
                email = f"{email_user}@intalent.asia"

                emp_type_raw = random.choice(EMP_TYPES)
                # Last 5% in EMP_TYPES is "permanent" but with executive salary
                is_executive = (emp_num % 20 == 0)  # 5% executives
                emp_type = emp_type_raw

                if is_executive:
                    salary = random.randint(*EXECUTIVE_SALARY)
                    tax_table = "01"
                else:
                    lo, hi = SALARY_RANGES.get(emp_type, (50_000, 150_000))
                    salary = random.randint(lo, hi)
                    tax_table = random.choice(TAX_TABLES[:4]) if salary > 100_000 else "01"

                # Join date: 1-10 years ago for permanent, 0-2 years for intern/probation
                if emp_type in ("intern","probation"):
                    days_ago = random.randint(30, 730)
                elif emp_type == "contract":
                    days_ago = random.randint(90, 1825)
                else:
                    days_ago = random.randint(180, 3650)
                join_date = date.today() - timedelta(days=days_ago)

                dept_id = random.choice(DEPT_IDS)
                bank    = random.choice(BANKS)
                city    = random.choice(CITIES)
                is_epf  = emp_type != "intern"
                is_etf  = emp_type != "intern"

                # 2% inactive
                is_active = random.random() > 0.02

                params_list.append({
                    "id":             str(uuid.uuid4()),
                    "company_id":     COMPANY_ID,
                    "employee_number":f"EMP{emp_num:04d}",
                    "full_name":      full_name,
                    "email":          email,
                    "mobile":         gen_mobile(),
                    "department_id":  dept_id,
                    "employment_type":emp_type,
                    "join_date":      join_date,
                    "basic_salary":   salary,
                    "is_epf":         is_epf,
                    "is_etf":         is_etf,
                    "tax_table":      tax_table,
                    "bank_name":      bank,
                    "bank_branch":    city,
                    "bank_account":   gen_bank_account(),
                    "nic":            gen_nic(),
                    "is_active":      is_active,
                })

            await session.execute(text(INSERT_SQL), params_list)
            await session.commit()

            done = batch_end
            print(f"  ✓ {done:,}/{total:,} inserted (EMP{start_num+batch_start:04d}–EMP{start_num+batch_end-1:04d})")

    await engine.dispose()
    print(f"\nDone! {total:,} employees seeded.")

if __name__ == "__main__":
    asyncio.run(seed())
