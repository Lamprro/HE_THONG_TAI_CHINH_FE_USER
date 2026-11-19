# Nguồn giá trực tiếp

Giá realtime không đi qua backend Java. Backend giữ dữ liệu đã chuẩn hóa, có provenance và luôn có giá trị;
FE gọi thẳng nhà cung cấp công khai để tránh polling backend liên tục.

| Dữ liệu | Nhà cung cấp | Endpoint | Đơn vị |
| --- | --- | --- | --- |
| Bảng giá (giá khớp, TC/trần/sàn, 3 bước giá mua/bán, khối ngoại) | VPS datafeed | `GET {VITE_LIVE_BOARD_URL}/getliststockdata/FPT,VNM,...` | Giá: nghìn VND. Khối lượng: lô 10 CP → FE nhân 10 thành CP |
| Chỉ số (VNINDEX, VN30, HNXINDEX, HNX30, UPCOM) | VPS datafeed | `GET {VITE_LIVE_BOARD_URL}/getlistindexdetail/10,11,02,12,03` | Điểm; giá trị khớp: triệu VND; `ot` chứa số mã tăng/giảm/đứng |
| Nến OHLCV phút/ngày/tuần | VNDirect dchart | `GET {VITE_LIVE_CHART_URL}/dchart/history?resolution=1|5|15|60|D|W&symbol=&from=&to=` | Giá cổ phiếu: nghìn VND; chỉ số: điểm; volume: CP |

Cả hai trả `Access-Control-Allow-Origin: *` nên gọi được trực tiếp, không cần proxy, không cần khóa.
Mã nguồn: `src/shared/live-parse.ts` (parser thuần, có unit test) và `src/shared/live.ts` (fetch + React Query).

## Chính sách gọi

- Chỉ polling trong giờ giao dịch (T2–T6, 09:00–15:00 giờ Việt Nam) và khi tab đang hiển thị: bảng giá/chỉ số 10 giây, nến trong ngày 30 giây.
- Ngoài giờ: không polling, dùng cache (React Query) và nút “Cập nhật” thủ công.
- Gộp tối đa 60 mã/lần gọi bảng giá. Không gọi backend Java cho mỗi tick.
- Dữ liệu backend (lịch sử giá đã lưu, BCTC, chỉ số, tin) cache 5–30 phút vì backend luôn có dữ liệu cố định.
- `VPS changePc` không có dấu: FE tự tính `change = lastPrice - r` để xác định tăng/giảm.
- Tắt toàn bộ nguồn trực tiếp: `VITE_LIVE_FEED=off`. FE quay về giá đã lưu `GET /api/v1/securities/{symbol}/quote`.

## Ranh giới

- Giá trực tiếp hiển thị kèm nhãn nguồn (VPS/VNDirect) và đơn vị nghìn VND, tách khỏi giá đã lưu (VND, có `sourceCode`, `priceBasis`).
- Không ghi giá trực tiếp xuống backend. Không dùng giá trực tiếp làm dữ liệu train/AI.
- Nguồn công khai có thể đổi định dạng hoặc chặn CORS bất kỳ lúc nào: parser từ chối dữ liệu sai dạng và UI hiển thị lỗi + giá đã lưu.
- Khi triển khai production cần kiểm tra điều khoản sử dụng của nhà cung cấp; có thể thay URL bằng proxy riêng qua biến `VITE_LIVE_*`.

## Adapter tùy chọn `VITE_QUOTE_URL`

Giữ hợp đồng cũ cho endpoint giá riêng (GET `symbol`, `exchange`) trả:

```ts
type Response = { data: { symbol: string; exchange: string; price: string | null; currency: string; asOf: string; source: string } };
```
