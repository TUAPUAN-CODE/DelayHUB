# 1. Forward port 80 → 5173 (ทำบน server)
netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=5173 connectaddress=172.48.0.115

# 2. เปิด Firewall port 80
netsh advfirewall firewall add rule name="PFCM HTTP" dir=in action=allow protocol=TCP localport=80

# 3. ดูว่า rule ถูกเพิ่มหรือยัง
netsh interface portproxy show all

# 4
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "172.48.0.115  pfcm"
