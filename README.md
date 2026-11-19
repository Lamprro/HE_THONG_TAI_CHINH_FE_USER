# Tài Chính User

Giao diện người dùng cho hệ thống dữ liệu tài chính. Công nghệ đồng bộ FE Admin gồm React 19, TypeScript, Vite, TanStack Query và Lucide.

## Chạy local

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Đặt `VITE_API_BASE_URL` là origin backend Java. Cổng mặc định của Vite là 5173. Khi chạy Admin cùng lúc, khai báo origin cổng User trong `APP_CORS_ALLOWED_ORIGINS` của backend.

```sh
pnpm typecheck
pnpm build
```

Biến `VITE_*` được đóng gói vào trình duyệt. Chỉ cấu hình URL công khai ở FE. Khóa DB, token admin và khóa nhà cung cấp thuộc cấu hình server.
