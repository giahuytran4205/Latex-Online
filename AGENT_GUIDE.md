# Hướng dẫn Phát triển & Vận hành Project (Dành cho AI Agent)

Tài liệu này tổng hợp kiến trúc hệ thống, quy trình deploy và các lưu ý quan trọng để đảm bảo tính ổn định của dự án **LaTeX Online Editor**.

## 1. Kiến trúc Hệ thống

Project bao gồm 3 thành phần chính:

*   **Frontend**: React (Vite) nằm trong thư mục `client`.
*   **Backend**: Node.js (Express) nằm trong thư mục `server`.
*   **Reverse Proxy**: Nginx (chạy trên Termux) đóng vai trò server chính.

### Luồng dữ liệu (Data Flow)
```
User (Internet) -> Cloudflare Tunnel -> Nginx (Port 8080) -> Frontend (Static Files)
                                                          -> Backend API (Port 3005 - Localhost only)
```

## 2. Cấu hình Mạng & Cloudflare

Để website hoạt động (`vibelatex.site`), cấu hình mạng **BẮT BUỘC** phải tuân thủ:

### Cloudflare Tunnel
*   **Service**: HTTP
*   **URL**: `localhost:8080` (Trỏ vào Nginx, KHÔNG trỏ vào Node.js port 3005).
*   **Public Hostname**: `vibelatex.site`.

### Cloudflare Dashboard (SSL/DNS)
*   **SSL/TLS Mode**: **Flexible** (Bắt buộc, vì Nginx server chạy HTTP).
*   **DNS**: CNAME trỏ về Tunnel domain (`xxx.cfargotunnel.com`), Proxy status: **Proxied (Orange Cloud)**.
*   **IPv6**: Nên bật để hỗ trợ tốt nhất, nhưng nếu gặp lỗi `fd10...` thì kiểm tra lại propagation.

### Nginx (Termux)
*   File config: `nginx/latex-online.conf`.
*   Listen: `8080 default_server`.
*   Server Name: `localhost vibelatex.site`.

### Node.js Backend
*   Port: `3005`.
*   **Bind Host**: `127.0.0.1` (Chỉ lắng nghe localhost, không cho phép truy cập trực tiếp từ ngoài để bảo mật).

## 3. Quy trình Deploy (Trên Termux)

Project được thiết kế để chạy trên môi trường Android (Termux). **KHÔNG** chạy lệnh build/deploy tùy tiện nếu không hiểu rõ môi trường.

### Cách update code mới lên Server:
1.  **Push code** từ local lên GitHub:
    ```bash
    git add .
    git commit -m "update: ..."
    git push origin main
    ```
2.  **SSH vào Server** (Termux) và chạy script update:
    ```bash
    cd ~/latex-online
    git pull
    # Nếu có sửa Nginx:
    cp nginx/latex-online.conf /data/data/com.termux/files/usr/etc/nginx/conf.d/
    nginx -s reload
    # Reload backend:
    pm2 reload latex-api
    ```

## 4. Firebase & Auth
*   Cần file `service-account.json` đặt tại root hoặc `server/` để Backend verify token.
*   Nếu lỗi "Firebase Admin not configured", kiểm tra file này đã được upload lên server chưa.

## 5. Các Lỗi Thường Gặp & Cách Fix

| Lỗi | Nguyên nhân | Cách Fix |
| :--- | :--- | :--- |
| **502 Bad Gateway** | Nginx không kết nối được Backend hoặc Cloudflare không kết nối được Nginx. | 1. Check Nginx: `nginx -t`.<br>2. Check PM2: `pm2 status`.<br>3. Check Port Tunnel: Phải là 8080. |
| **522 Connection Timed Out** | Cloudflare không gọi được Server. | Check Tunnel đang chạy không. Check mạng Server. |
| **Redirect Loop / 520** | Sai chế độ SSL Cloudflare. | Chuyển SSL sang **Flexible**. |
| **Website hiện IP IPv6 ảo (`fd10...`)** | Domain chưa Active hoặc DNS cache. | Vào Cloudflare Dashboard check domain Status. Chờ Active. |

---
**Lưu ý cho Agent:** Khi sửa code, luôn đảm bảo giữ nguyên cấu trúc Port (8080 cho Nginx, 3005 cho API Local) để tránh sập hệ thống.
