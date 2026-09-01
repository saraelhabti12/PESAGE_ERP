import httpx

def run_checks():
    client = httpx.Client()

    # 1. Frontend clean load
    r_fe = client.get("http://localhost:5173")
    print("1. FRONTEND HTTP STATUS:", r_fe.status_code)
    assert r_fe.status_code == 200
    assert '<div id="root"></div>' in r_fe.text

    # 2. Pesage 2000 logo load
    r_logo = client.get("http://localhost:5173/branding/pesage-2000-logo.png")
    print("2. PESAGE 2000 LOGO STATUS:", r_logo.status_code, len(r_logo.content), "bytes")
    assert r_logo.status_code == 200

    # 3. Auth check
    r_login = client.post("http://localhost:8000/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "CHANGE_THIS_PASSWORD"
    })
    print("3. LOGIN STATUS:", r_login.status_code)
    assert r_login.status_code == 200

    print("\n -> VITE / TAILWIND BUILD AND RUNTIME VERIFICATION SUCCESSFUL!")

if __name__ == "__main__":
    run_checks()
