import httpx

def verify():
    client = httpx.Client()
    
    # 1. Frontend Server check
    r_fe = client.get("http://localhost:5173")
    print("1. FRONTEND HTTP STATUS:", r_fe.status_code)
    assert r_fe.status_code == 200
    assert '<div id="root"></div>' in r_fe.text
    print("   -> React index.html served correctly at http://localhost:5173")
    
    # 2. Backend Health check
    r_be = client.get("http://localhost:8000/health")
    print("2. BACKEND HEALTH STATUS:", r_be.status_code, r_be.json())
    assert r_be.status_code == 200
    
    # 3. Login API call from client
    r_login = client.post("http://localhost:8000/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "CHANGE_THIS_PASSWORD"
    })
    print("3. LOGIN API STATUS:", r_login.status_code)
    assert r_login.status_code == 200
    tokens = r_login.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    print("   -> Login succeeded, access & refresh tokens issued.")
    
    # 4. Authenticated /me API call
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    r_me = client.get("http://localhost:8000/api/v1/auth/me", headers=headers)
    print("4. AUTH /ME STATUS:", r_me.status_code, r_me.json()["email"])
    assert r_me.status_code == 200
    user_data = r_me.json()
    assert user_data["email"] == "admin@example.com"
    assert "password_hash" not in user_data
    print("   -> /me succeeded, user profile loaded, password_hash excluded.")

if __name__ == "__main__":
    verify()
