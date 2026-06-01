"""
Generate seed SQL for 10,000 employees. Run locally, pipe output to psql.
"""
import random, uuid, sys
from datetime import date, timedelta

COMPANY_ID = "3e8d750e-7313-4fd8-af82-a619a7609522"

DEPT_IDS = [
    "872971d1-a1ec-484e-b91e-c9a389cf70fc",  # ENG
    "88b8e56f-e3ea-4276-928a-6f1cc12207d7",  # FIN
    "5f4bdfd3-ce83-4651-868b-6ad0fc901925",  # HR
    "f8db93cc-73ca-4875-814a-781a063c33dc",  # IT
    "93e4c007-1beb-40de-bdc6-095f05d09524",  # OPS
    "e06db144-e364-41a2-b71e-97e158125ec2",  # SAL
]

FIRST_M = ["Kamal","Nimal","Ruwan","Lasith","Chaminda","Dinesh","Pradeep","Saman","Roshan","Ajith",
           "Mahesh","Dilshan","Kasun","Thilak","Nuwan","Sanjeewa","Asanka","Buddhika","Chathura","Dilan",
           "Eranga","Gayan","Harsha","Isuru","Janaka","Kapila","Lahiru","Madusanka","Naveen","Oshan",
           "Pasan","Ruchira","Supun","Thilina","Udara","Vimukthi","Wimal","Yasith","Amila","Binara",
           "Chanaka","Dasun","Eshan","Gamini","Hasitha","Indika","Jayantha","Kumara","Lakshman","Madura",
           "Nilantha","Pathum","Rathna","Sachith","Tharindu","Uditha","Vasitha","Wickrama","Yohan",
           "Asel","Chanuka","Danushka","Fathim","Ishan","Kishara","Lakshan","Minura","Praveen","Ravindu",
           "Sampath","Thilan","Upul","Viraj","Waruna","Yashan","Ashan","Banusha","Chamath","Danula"]
FIRST_F = ["Priya","Sandya","Nadeeka","Chamari","Dilhani","Rashmi","Thilini","Anusha","Malika","Niluka",
           "Kumari","Sriyani","Roshani","Amara","Buddhini","Chathurika","Deepika","Erandi","Gayani",
           "Hiruni","Ishani","Jayani","Kavindi","Lakshmi","Manjula","Nawoda","Oshadhi","Piyumi","Ruwini",
           "Sachini","Tharushi","Udayangani","Vasana","Waruni","Yasodha","Zainab","Achini","Binara",
           "Chathuri","Damayanthi","Geetha","Hasini","Imasha","Janitha","Keshari","Lakmali","Maheshi",
           "Naduni","Oneli","Pavithra","Ridma","Surangi","Thisari","Upeksha","Vimansa","Wathsala",
           "Ashini","Bhagya","Chandani","Dilini","Gimhani","Hansani","Inoka","Jayamali","Kishani"]
LAST = ["Perera","Silva","Fernando","Rajapaksha","Bandara","Wickramasinghe","Jayasinghe","Dissanayake",
        "Gunasekara","Herath","Karunaratne","Liyanage","Navaratne","Peiris","Ratnayake","Samarasinghe",
        "Tennakoon","Udawatta","Vithanage","Weerasekara","Yatawara","Zoysa","Abeysekera","Balasuriya",
        "Chathuranga","Dasanayake","Edirisuriya","Fonseka","Gamage","Halwatura","Illeperuma","Jayalath",
        "Kulatunga","Lokuge","Madanayake","Nanayakkara","Pathirana","Ranasinghe","Subasinghe",
        "Thilakarathna","Udugama","Vidanapathirana","Wijethunga","Amarasinghe","Dharmaratne","Ekanayake",
        "Galagoda","Haputhanthri","Jayawardena","Liyanarachchi","Mahipala","Niroshan","Chandrasekara"]
BANKS = ["BOC","HNB","Sampath","Commercial","NDB","Seylan","NSB","DFCC","Pan Asia","Hatton National"]
CITIES = ["Colombo","Kandy","Galle","Negombo","Matara","Kurunegala","Anuradhapura","Ratnapura","Badulla","Jaffna"]
TAX_TABLES = ["TABLE_01","TABLE_02","TABLE_03","TABLE_04"]

# Type distribution — DB enum values (uppercase)
TYPES_POOL = ["INTERN"]*15 + ["PERMANENT"]*50 + ["CONTRACT"]*20 + ["PROBATION"]*10 + ["PERMANENT"]*5
SALARY = {"INTERN":(18000,35000),"PROBATION":(40000,65000),"CONTRACT":(50000,120000),"PERMANENT":(60000,250000)}

def q(s): return s.replace("'","''")

def gen_nic():
    y = random.randint(1975,2004)
    d2 = random.randint(1,365)
    t = random.randint(1000,9999)
    if y >= 2000: return f"{y}{d2:03d}{t:04d}"
    return f"{str(y)[-2:]}{d2:03d}{t:04d}{random.choice(['V','X'])}"

def gen_acc(): return "".join([str(random.randint(0,9)) for _ in range(10)])
def gen_mob():
    return random.choice(["071","072","075","076","077","078"]) + "".join([str(random.randint(0,9)) for _ in range(7)])

print("BEGIN;")
today = date.today()

for i in range(10000):
    emp_num = i + 4  # EMP001-003 exist
    emp_id  = str(uuid.uuid4())
    gender  = random.choice(["M","F","M"])  # slight male majority
    first   = random.choice(FIRST_M if gender=="M" else FIRST_F)
    last    = random.choice(LAST)
    name    = f"{first} {last}"
    email   = f"{first.lower()}.{last.lower()}{emp_num}@intalent.asia"

    is_exec = (emp_num % 20 == 0)
    emp_type = random.choice(TYPES_POOL)

    if is_exec:
        salary   = random.randint(200000, 600000)
        emp_type = "PERMANENT"
        tax_code = "TABLE_01"
    else:
        lo, hi = SALARY.get(emp_type, (60000, 200000))
        salary   = random.randint(lo, hi)
        tax_code = "TABLE_01" if salary < 100000 else random.choice(TAX_TABLES)

    if emp_type in ("INTERN","PROBATION"):
        days_ago = random.randint(30, 730)
    elif emp_type == "CONTRACT":
        days_ago = random.randint(90, 1825)
    else:
        days_ago = random.randint(180, 3650)
    join_dt = today - timedelta(days=days_ago)

    dept_id  = random.choice(DEPT_IDS)
    bank     = random.choice(BANKS)
    city     = random.choice(CITIES)
    is_epf   = "true" if emp_type != "INTERN" else "false"
    is_etf   = is_epf
    is_active = "true" if random.random() > 0.02 else "false"
    nic      = gen_nic()
    acc      = gen_acc()
    mob      = gen_mob()

    print(
        f"INSERT INTO employees (id,company_id,employee_number,full_name,email,mobile,"
        f"department_id,employment_type,join_date,basic_salary,"
        f"is_epf_applicable,is_etf_applicable,tax_table_code,"
        f"bank_name,bank_branch,bank_account_number,nic_number,is_active,created_at,updated_at) "
        f"VALUES ('{emp_id}','{COMPANY_ID}','EMP{emp_num:04d}','{q(name)}','{q(email)}','{mob}',"
        f"'{dept_id}','{emp_type}','{join_dt}',{salary},"
        f"{is_epf},{is_etf},'{tax_code}',"
        f"'{bank}','{city}','{acc}','{nic}',{is_active},NOW(),NOW()) ON CONFLICT (company_id,employee_number) DO NOTHING;"
    )

print("COMMIT;")
print(f"\\echo 'Done: 10000 employees inserted'", file=sys.stderr)
