def is_prime(n: int) -> bool:
    if n < 2:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False

    divisor = 3
    while divisor * divisor <= n:
        if n % divisor == 0:
            return False
        divisor += 2

    return True


def find_primes_up_to(limit: int):
    return [n for n in range(2, limit + 1) if is_prime(n)]


if __name__ == "__main__":
    primes = find_primes_up_to(1000)
    print("Prime numbers up to 1000:")
    print(primes)
