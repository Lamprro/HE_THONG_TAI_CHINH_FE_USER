# Nguồn giá trực tiếp

Nguồn trực tiếp đang chờ người dùng chọn và kết nối. Mặc định FE đọc snapshot đã lưu tại `GET /api/v1/securities/{symbol}/quote`. Cache 5 phút, cập nhật thủ công, hiển thị thời điểm và nguồn thật.

Khi có nhà cung cấp, đặt `VITE_QUOTE_URL` thành endpoint HTTPS công khai có CORS cho origin FE. Adapter ở `src/shared/quotes.ts` gửi GET với `symbol` và `exchange`. Chỉ màn chi tiết đang mở cập nhật mỗi 60 giây và dừng polling khi tab trình duyệt ẩn. Có thể thay adapter bằng SDK/WebSocket của nhà cung cấp sau khi xác định hợp đồng và quyền sử dụng.

Response của adapter công khai

```ts
type Response = {
  data: {
    symbol: string;
    exchange: string;
    price: string | null;
    currency: string;
    asOf: string; // ISO 8601, thời điểm giá tại nguồn
    source: string;
  };
};
```

Giữ nguyên đơn vị tiền tệ của nguồn. Adapter từ chối giá sai mã/sàn, ngày sai và số không hợp lệ. Nếu nhà cung cấp cần secret, dùng dịch vụ server của nguồn để bảo vệ secret. FE chỉ nhận URL công khai, không cấu hình khóa trong `VITE_*`.

Lỗi nguồn trực tiếp được hiển thị và có nút thử lại. Giá cache đi kèm mốc thời gian. Lịch sử giá và BCTC tiếp tục đọc API Java có provenance.
