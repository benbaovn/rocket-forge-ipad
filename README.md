# 🚀 Rocket Forge – iPad Edition (`rocket-forge-ipad`)

Phiên bản **iPadOS Native** của **Rocket Forge – 3D Spaceflight Simulator**, đóng gói bằng **Capacitor 8 + Swift Package Manager + Xcode** với toàn bộ giao diện cảm ứng đa điểm, Joystick 360°, thanh kéo ga trực tiếp, phản hồi rung Haptics và cấu hình GPU Apple Metal tối ưu riêng cho màn hình iPad.

## 1. Cài đặt khi clone repo về máy Mac mới

```bash
git clone https://github.com/benbaovn/rocket-forge-ipad.git
cd rocket-forge-ipad
npm install
npm run ios:sync
npm run ios:open
```

## 2. Build & chạy lên iPad trong Xcode

1. Mở `ios/App/App.xcodeproj` bằng lệnh `npm run ios:open` (hoặc mở trực tiếp trong Xcode).
2. *(Nếu dùng Xcode 16 lần đầu chưa tải gói iOS)*: vào **Xcode → Settings → Components** bấm **Get** ở mục **iOS**.
3. Chọn project **App** ở cột trái → tab **Signing & Capabilities**:
   - Bật **Automatically manage signing** và chọn **Team** (Apple Developer Account của bạn).
   - Đổi **Bundle Identifier** nếu cần tên gói riêng (mặc định: `xyz.benteck.rocketforge`).
4. Cắm iPad vào Mac (hoặc qua Wi-Fi), chọn thiết bị iPad trên thanh công cụ Xcode và nhấn **Run (`⌘R`)**.

## 3. Đồng bộ khi chỉnh sửa code game

Mỗi khi cập nhật mã nguồn trong `src/` hoặc `index.html`:

```bash
npm run ios:sync
```

Sau đó bấm **Run (`⌘R`)** lại trong Xcode.
