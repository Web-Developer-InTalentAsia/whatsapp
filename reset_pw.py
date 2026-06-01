import bcrypt
import asyncio
import asyncpg
import os

async def reset():
    h = bcrypt.hashpw(b'Admin@1234', bcrypt.gensalt(rounds=12)).decode()
    dsn = (
        f"postgresql://{os.environ['POSTGRES_USER']}:"
        f"{os.environ['POSTGRES_PASSWORD']}@"
        f"{os.environ['POSTGRES_HOST']}:"
        f"{os.environ['POSTGRES_PORT']}/"
        f"{os.environ['POSTGRES_DB']}"
    )
    conn = await asyncpg.connect(dsn)
    await conn.execute(
        "UPDATE public.users SET hashed_password = $1 WHERE email = $2",
        h, 'admin@intalent.asia'
    )
    await conn.close()
    print(f'Password reset to Admin@1234. Hash prefix: {h[:15]}')

asyncio.run(reset())
