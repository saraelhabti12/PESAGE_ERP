from app.security.passwords import hash_password, verify_password


def test_password_hashing_and_verification():
    raw_password = "SecretPassword123!"
    hashed = hash_password(raw_password)
    
    assert hashed != raw_password
    assert len(hashed) > 20
    assert verify_password(raw_password, hashed) is True


def test_invalid_password_fails_verification():
    raw_password = "SecretPassword123!"
    wrong_password = "WrongPassword456!"
    hashed = hash_password(raw_password)
    
    assert verify_password(wrong_password, hashed) is False
