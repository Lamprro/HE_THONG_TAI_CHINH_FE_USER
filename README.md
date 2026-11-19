# Tài Chính User

Giao diện người dùng (phong cách terminal chứng khoán kiểu FireAnt) cho hệ thống dữ liệu tài chính.
Công nghệ đồng bộ FE Admin: React 19, TypeScript, Vite 7, TanStack Query 5, Lucide. Không thêm thư viện biểu đồ: nến, sparkline, bar vẽ bằng Canvas/SVG.

## Chạy local

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev            # http://127.0.0.1:5173
```

`VITE_API_BASE_URL` là origin backend Java (mặc định `http://localhost:8080`). Origin FE phải có trong `APP_CORS_ALLOWED_ORIGINS` của backend.

```sh
pnpm typecheck
pnpm build
pnpm test           # unit test parser nguồn giá trực tiếp
pnpm test:e2e       # E2E thật với backend + DB (cần dev server, backend, Playwright + Chrome)
```

## Hai nguồn dữ liệu

| Loại | Nguồn | Tần suất |
| --- | --- | --- |
| Giá realtime, sổ lệnh, chỉ số, nến phút/ngày | Gọi thẳng VPS datafeed + VNDirect dchart từ trình duyệt (xem `docs/QUOTE_SOURCE.md`) | 10–30 giây trong giờ giao dịch, khi tab hiển thị |
| Danh mục mã, hồ sơ, lịch sử giá đã lưu, BCTC, chỉ số, khối ngoại, tin, vĩ mô, AI | Backend Java `/api/v1` (GET công khai, không token) | Cache 5–60 phút; backend luôn có dữ liệu cố định |

Khi nguồn trực tiếp lỗi hoặc tắt (`VITE_LIVE_FEED=off`), FE tự quay về giá/nến đã lưu của backend.

## Màn hình

| Route | Nội dung |
| --- | --- |
| `#/market` | Thẻ chỉ số realtime + sparkline, độ rộng HOSE, top tăng/giảm, bảng giá theo rổ (Mã hệ thống / VN30 / HNX30 / HOSE / HNX / UPCoM), sắp xếp cột, nháy màu khi giá đổi |
| `#/index/{VNINDEX\|VN30\|HNXINDEX\|HNX30\|UPCOM}` | Nến chỉ số, độ rộng, cổ phiếu thành phần, lịch sử điểm đã lưu |
| `#/securities` | Tìm mã, giá trực tiếp |
| `#/security/{mã}?exchange=&tab=` | Tab Tổng quan · Biểu đồ (nến, MA20/50, sổ lệnh) · Tài chính (ma trận + lineage) · Chỉ số · Khối ngoại · Tin tức · AI & Dự báo · Hồ sơ |
| `#/watchlist` | Danh sách theo dõi (localStorage) với bảng giá trực tiếp, xuất/nhập file JSON |
| `#/screener` | Bộ lọc theo sàn/ngành/chỉ số, preset |
| `#/compare?symbols=` | So sánh tối đa 10 mã |
| `#/macro` | Chuỗi vĩ mô Việt Nam |
| `#/ai` | Trung tâm AI: trạng thái reader LLM, bộ mô hình Local AI |
| `#/news`, `#/news/{id}` | Tin, lọc ngày, mã liên quan, phân tích AI đã công bố |

Ô tìm kiếm (phím `/`) gợi ý cả mã hệ thống lẫn mọi mã HOSE/HNX/UPCoM. Mã chưa có trong DB vẫn mở được trang chi tiết với giá, sổ lệnh và nến trực tiếp; mã trùng nhiều sàn (409) hiện màn chọn sàn.

Local AI research preview chỉ hiện khi backend chạy với `financial.local-ai.research-preview.enabled=true` (mặc định tắt, endpoint trả 404 và FE ẩn khối này).

Biến `VITE_*` được đóng gói vào trình duyệt. Không đặt khóa DB, token admin hay khóa nhà cung cấp ở FE.
