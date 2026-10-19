import asyncio

async def odds():
    for n in range(1, 11, 2):
        print(n)
        if n < 9:
            await asyncio.sleep(1)

async def evens():
    for n in range(2, 11, 2):
        print(n)
        if n < 10:
            await asyncio.sleep(1)

async def main():
    await asyncio.gather(odds(), evens())

asyncio.run(main())
