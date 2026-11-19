# Báo cáo phát triển FE User và luồng Local AI — 19/11/2026

## 1. Tóm tắt

| Hạng mục | Kết quả |
| --- | --- |
| FE User (`HE_THONG_DATA_TAI_CHINH_FE_USER`) | 21 commit mới trên `main` (14 vòng 1 + 7 vòng 2) (local, **chưa push**), 9 nhóm màn hình, dùng 23 route GET backend + 2 nguồn giá trực tiếp |
| Nguồn giá trực tiếp | VPS datafeed (bảng giá, sổ lệnh, chỉ số) + VNDirect dchart (nến) gọi thẳng từ trình duyệt; backend không bị polling |
| Kiểm thử FE | Typecheck + build PASS · 6 unit test PASS · E2E 19/19 bước PASS với backend + DB thật, gồm mobile 390px |
| Backend Java | Nhánh mới `feature/local-ai-research-preview` (1 commit local, **chưa push**): endpoint xem trước Local AI, **mặc định tắt** |
| Kiểm thử backend | Smoke user API trên DB thật PASS 38 route / 60 request (cả chế độ bật và tắt) · 3 unit test mới PASS · toàn bộ 398 test: 2 fail **có sẵn từ trước** (luồng News) |

## 2. Hiện trạng ban đầu

- Repo FE User có 2 commit (khung React + API client) và phần Codex làm dở chưa commit (tách màn Market/Security/News), đang **lỗi typecheck** 1 chỗ.
- Backend chạy được với DB `192.168.50.12`, 37 GET công khai `/api/v1` đều PASS smoke. Dữ liệu giá lưu đến 12/11/2026, nhiều mã còn phiên 16/10 → cần nguồn giá trực tiếp.
- Local AI: gói `1d5b62a8…` đã có 218 dự đoán lưu trong DB, trạng thái `RESEARCH_ONLY`, backend cố ý không trả giá trị dự đoán (chờ chính sách công bố).

## 3. Danh sách commit FE (theo thứ tự)

| Commit | Nội dung |
| --- | --- |
| `b2a6064` Tach man hinh thi truong, co phieu va tin tuc | Commit phần Codex để lại + sửa lỗi typecheck |
| `634fe2c` Them nguon gia truc tiep VPS va VNDirect | `live-parse.ts` (parser thuần, có test), `live.ts` (fetch + React Query, polling theo giờ giao dịch), docs nguồn giá |
| `9438d9d` Bang gia truc tiep, chi so va do rong thi truong | Thẻ chỉ số realtime + sparkline, độ rộng HOSE, top tăng/giảm, bảng giá kiểu FireAnt |
| `ac35409` Bieu do nen, so lenh va gia truc tiep cho tung ma | Canvas candlestick + volume + MA20/50 + crosshair, sổ lệnh 3 bước giá, quyền/sự kiện, fallback giá đã lưu |
| `174309c` Tong quan ma: chi so chinh, KQKD theo quy va trang thai du lieu | Tab Tổng quan dùng `/overview`, `/compare`, `/financials` |
| `2b5094d` Ma tran tai chinh, chi so va nguon goc du lieu | Ma trận BCTC chọn chỉ tiêu, dialog lineage báo cáo/chỉ số |
| `2a7a4a0` Khoi ngoai, AI va lich su niem yet cho tung ma | Biểu đồ ròng khối ngoại, AI & Dự báo, reference observations |
| `89936a9` Bo loc co phieu va dieu huong theo nhom | Screener + preset, sidebar theo nhóm, rail theo dõi có giá trực tiếp |
| `fb573bb` So sanh doanh nghiep theo chi so | Trang so sánh tối đa 10 mã |
| `1da3fd0` So sanh tu dong gop chi so, trang vi mo va trung tam AI | Gộp chỉ số PROVIDER + DERIVED, trang Vĩ mô, Trung tâm AI |
| `bf1c323` Tin tuc: tim kiem, loc ngay, ma lien quan va phan tich AI | Tìm/lọc ngày, mã liên quan có giá, phân tích LLM đã công bố |
| `fa639a8` Kiem thu E2E luong user va sua giao dien mobile | `tests/e2e.mjs`, sửa tràn ngang mobile |
| `934730d` Xem truoc ket qua nghien cuu Local AI ... | Khối preview Local AI (ẩn khi backend tắt) |
| (commit cuối) | README + báo cáo này |

## 4. Kiến trúc dữ liệu

```
Trình duyệt ──(10–30s, giờ giao dịch)──► VPS datafeed / VNDirect dchart   (giá realtime, không lưu)
     │
     └──(cache 5–60 phút, GET không token)──► Java /api/v1 ──► PostgreSQL (dữ liệu chuẩn hóa, có provenance)
```

- **Không polling backend**: dữ liệu backend cố định, cache dài (staleTime 15–60 phút). Chỉ giá trực tiếp được làm mới.
- Polling chỉ chạy T2–T6 09:00–15:00 (giờ VN) và khi tab hiển thị; ngoài giờ dùng cache + nút “Cập nhật”.
- Đơn vị được ghi rõ: giá trực tiếp **nghìn VND**, giá đã lưu **VND**; VPS gửi khối lượng theo lô 10 CP → FE nhân 10 (đã đối chiếu: FPT 1.843.770 × 10 = 18.437.700 khớp VNDirect).
- `changePc` của VPS không có dấu → FE tự tính `giá − tham chiếu` (unit test bao phủ).
- Số tiền/ID từ backend giữ dạng chuỗi; chỉ quy đổi Number để vẽ/hiển thị rút gọn, title giữ số chính xác.

## 5. Màn hình và API sử dụng

| Màn | Backend `/api/v1` | Nguồn ngoài |
| --- | --- | --- |
| Tổng quan thị trường | `market/overview` | VPS stock + index, dchart 1 phút cho sparkline |
| Cổ phiếu, Theo dõi | `securities` | VPS stock |
| Chi tiết mã | `securities/{s}`, `overview`, `prices`, `statements`, `statements/{id}`, `statement-items`, `financials`, `statements/{id}/lineage`, `metrics`, `securities/{s}/metrics`, `metrics/{id}/lineage`, `compare`, `foreign-trades`, `reference-observations`, `news`, `forecasts`, `local-ai`, (`local-ai/research-preview` nếu bật) | VPS stock, dchart 1/5/60/D/W |
| Bộ lọc | `market/filters`, `metrics`, `market/screener` | VPS stock |
| So sánh | `securities/compare` (PROVIDER + DERIVED) | VPS stock |
| Vĩ mô | `macro/series`, `macro/series/{id}/observations` | — |
| Trung tâm AI | `analysis/availability`, `local-ai/models` | — |
| Tin tức | `news`, `news/{id}`, `news/{id}/analysis` | VPS stock (mã liên quan) |

## 6. Kiểm thử đã chạy thật

### FE
- `tsc --noEmit` và `vite build` PASS (bundle chính 300 kB, gzip 94 kB; các trang lazy-load).
- `node --test tests/*.test.mjs`: **6/6 PASS** — parser VPS (đơn vị, dấu, lô 10 CP, mức giá rỗng/ATO), chỉ số, dchart, màu giá, khung giờ giao dịch.
- `tests/e2e.mjs` (Chrome thật qua Playwright): **19/19 bước PASS** — market → tìm FPT → theo dõi → 8 tab chi tiết → watchlist → screener → compare → macro → news → bài viết → AI center → mobile 390px (không tràn ngang). Ghi nhận 23 route backend được gọi, **chỉ GET**, không lỗi trang/5xx.

**Giới hạn quan trọng của E2E**: trong test headless, 17 request tới VPS/VNDirect được **chặn và trả fixture** (định dạng chép từ response thật). Lý do: dchart trả 403 cho User-Agent “HeadlessChrome”, và tôi không giả User-Agent để lách chặn của nhà cung cấp. Vì vậy **số giá/nến trong ảnh chụp E2E là dữ liệu giả của test**; dữ liệu backend (danh sách mã, BCTC, chỉ số, tin, vĩ mô, AI) là thật. Adapter nguồn ngoài được kiểm bằng unit test parser và gọi curl thật trong phiên làm việc (CORS `*`, định dạng như mô tả). **Cần bạn mở `pnpm dev` trên trình duyệt thường để xác nhận giá thật hiển thị.**

### Backend
- `scripts/user_api_smoke.py` trên DB thật, localhost:8080: PASS **38 route / 60 request** ở cả hai chế độ (preview bật: kiểm không lộ field riêng tư; preview tắt: 404).
- `UserLocalAiPreviewServiceTests` 3/3 PASS. Test đã phát hiện và sửa một lỗi thật: Jackson đọc số thực thành double làm mất chính xác (`0.6123456789012345678` → `…2346`); đã chuyển sang BigDecimal.
- `mvn -o test` toàn bộ: 398 test, 2 fail, 121 skipped (cần DB cô lập). 2 fail ở `NewsPipelineIntegrationFlowTests` **fail y hệt trên nhánh gốc `refactor/admin-cleanup`** trước khi tôi sửa — không do thay đổi này, cần xử lý riêng.

## 7. Luồng Local AI — phần làm tiếp

**Quyết định**: không mở công khai giá trị dự đoán, vì gói đang `RESEARCH_ONLY` và tài liệu dự án yêu cầu chính sách công bố trước (không “chỉ đổi cờ”). Thay vào đó:

- Backend: `GET /api/v1/securities/{symbol}/local-ai/research-preview`, **tắt mặc định** (`financial.local-ai.research-preview.enabled=false` → 404). Khi bật, trả kết quả selected mới nhất mỗi model với cùng điều kiện kiểm định như bộ đếm hiện có, chỉ chiếu whitelist trường hợp đồng đầu ra; không trả input, feature, đường dẫn PKL, payload run. Chi tiết: `HE_THONG_DATA_TAI_CHINH_BACKEND_JAVA/docs/LOCAL_AI_RESEARCH_PREVIEW_20261119.md`.
- FE: tab “AI & Dự báo” hiển thị khối “Xem trước kết quả nghiên cứu” (hướng Tăng/Không tăng + điểm chưa hiệu chỉnh, LNST dự báo, phân vị lợi suất, biến động, drawdown) kèm cảnh báo RESEARCH_ONLY; tự ẩn khi backend trả 404.
- Đọc thật FPT khi bật: 11 kết quả (vd. direction_h4 = Tăng, điểm 0,657; npat_h2 2026Q4 ≈ 3.438,6 tỷ VND; volatility_h1 27,52%).

Backend đang chạy lại ở **chế độ mặc định (preview tắt)**.

## 8. Việc cần bạn quyết định / làm tiếp

1. **Push**: FE `main` (21 commit) và backend nhánh `feature/local-ai-research-preview` đều chỉ ở local. Backend tách từ `refactor/admin-cleanup` (nhánh hiện tại lúc bắt đầu), không phải `main`.
2. **Kiểm giá thật trên trình duyệt thường** (mục 6). Kiểm tra điều khoản sử dụng VPS/VNDirect trước khi lên production; có thể thay URL bằng proxy riêng qua `VITE_LIVE_BOARD_URL` / `VITE_LIVE_CHART_URL`.
3. **Chính sách công bố Local AI**: khi chốt, thay preview bằng reader chính thức + nghiệm thu riêng.
4. Backend chưa có watchlist/tài khoản người dùng → watchlist đang lưu localStorage.
5. Sửa 2 test News fail có sẵn.
6. Dữ liệu: nhiều mã còn phiên giá 16/10, BCTC thiếu `publishedAt`/scope (data-status báo PARTIAL) — thuộc pipeline backend.

## 9. Chạy lại

```sh
# Backend (repo Java, tại thư mục gốc để nạp application-local.properties)
java -jar target/he-thong-data-tai-chinh-backend-0.0.1-SNAPSHOT.jar
#   thêm --financial.local-ai.research-preview.enabled=true để bật preview (chỉ local)
python scripts/user_api_smoke.py --base http://127.0.0.1:8080 --report target/user-http.json

# FE
pnpm dev
pnpm test
PLAYWRIGHT_MODULE=<đường dẫn playwright> pnpm test:e2e   # ảnh lưu ở test-results/screens (git ignore)
```

Môi trường máy hiện tại không có Node trong PATH; tôi dùng Node 24 kèm Visual Studio (`D:\Visual Studio\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe`) và Playwright trong `FE_ADMIN/node_modules`.

---

## 10. Vòng cải thiện thứ hai (tự rà soát)

### Lỗi/thiếu sót tự phát hiện và đã sửa

| # | Vấn đề | Cách sửa |
| --- | --- | --- |
| 1 | Mã không có trong DB (vd. VHM) → trang chi tiết lỗi 404 toàn trang dù vẫn có giá trực tiếp | Chế độ “chỉ giá trực tiếp”: thông báo rõ, hiển thị giá, sổ lệnh, nến từ VPS/VNDirect |
| 2 | Mã trùng nhiều sàn (409) không có lối đi tiếp | Màn chọn sàn từ danh sách hệ thống, không tự đoán sàn |
| 3 | Lỗi API hiển thị tiếng Anh | `errorMessage()` ánh xạ NETWORK/TIMEOUT/400/404/409/422/5xx sang tiếng Việt |
| 4 | Ô giá đã lưu gọi backend ngay cả khi giá trực tiếp đang tải | Chỉ gọi khi nguồn trực tiếp tắt/lỗi/không có mã |
| 5 | Một batch VPS lỗi làm trống cả bảng; polling cả giờ nghỉ trưa | `Promise.allSettled` giữ batch thành công; bỏ polling 11:30–13:00; thử lại 1 lần khi lỗi mạng; giữ dữ liệu cũ khi đổi danh sách |
| 6 | Bấm theo dõi khi chưa rõ sàn → mục bị loại âm thầm khi đọc lại | Nút theo dõi vô hiệu cho tới khi xác định được sàn |
| 7 | Tab chi tiết mã mất khi F5; tiêu đề trình duyệt cố định | Tab lưu vào URL (`&tab=`, replaceState); tiêu đề theo mã/giá/VN-Index |
| 8 | Ô giá nháy cả ở lần render đầu | Chỉ nháy khi giá/khối lượng thực sự thay đổi |
| 9 | Nhãn sai: “Độ rộng HOSE” trên trang VN30; giá đã lưu hiện số 0 thừa | Sửa nhãn theo chỉ số; bỏ số 0 thừa |

### Tính năng mới

- **Bảng giá theo rổ** kiểu FireAnt: Mã hệ thống / VN30 / HNX30 / HOSE / HNX / UPCoM (danh sách rổ từ VPS, cache 6 giờ), sắp xếp theo mã/giá/%/KL/NN ròng, render 100 dòng + “Hiển thị thêm” cho sàn lớn, polling 15 giây khi > 60 mã. Tab chọn được nhớ trên trình duyệt.
- **Nhãn phiên**: Chưa mở cửa / ATO / Phiên sáng / Nghỉ trưa / Phiên chiều / ATC / Thỏa thuận / Đã đóng cửa.
- **Trang chi tiết chỉ số** (`#/index/VN30`, bấm thẻ chỉ số): nến trực tiếp (fallback điểm đã lưu), độ rộng, bảng giá cổ phiếu thành phần, lịch sử điểm đã lưu.
- **Tìm kiếm gợi ý** (phím `/`, ↑ ↓ Enter, Esc): gộp mã hệ thống (backend) + toàn bộ mã sàn (VPS), mã chính xác lên đầu.
- **Xuất/nhập danh sách theo dõi** (JSON), qua cùng bộ kiểm tra hợp lệ như dữ liệu đã lưu.

### Kiểm thử vòng 2

- Unit test: **10/10 PASS** (thêm giờ nghỉ trưa/nhãn phiên, gộp gợi ý tìm kiếm, validate nhập watchlist).
- E2E: **25 bước PASS** trên dev server, và **25 bước PASS trên bản build production** (`vite preview`), gồm: tab VN30 + sắp xếp %, giới hạn 100 dòng HOSE, tìm kiếm bàn phím, trang VN30, xuất/nhập watchlist, mã ngoài hệ thống, mở tab từ URL, mobile.
- Như vòng 1: request tới VPS/VNDirect trong E2E được trả fixture; dữ liệu backend là thật.
