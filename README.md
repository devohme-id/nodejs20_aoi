# Smart AOI Dashboard

Smart AOI Dashboard adalah aplikasi Node.js yang menyediakan dasbor untuk memantau dan menganalisis data dari sistem _Automated Optical Inspection_ (AOI). Aplikasi ini menggunakan _server-sent events_ (SSE) untuk mengirimkan pembaruan _real-time_ ke klien yang terhubung.

## Fitur

- **Dasbor Real-time:** Menampilkan data AOI secara _real-time_.

- **Server-Sent Events (SSE):** Menggunakan SSE untuk mengirimkan pembaruan data ke klien tanpa perlu polling.

- **Konfigurasi PM2:** Konfigurasi PM2 untuk memastikan aplikasi berjalan dengan stabil dan dapat diandalkan.
- **Penanganan Kesalahan:** Penanganan kesalahan global untuk mencatat dan melaporkan kesalahan yang terjadi.

## Cara Penggunaan

1.  **Instalasi:**

    ```bash
    npm install
    ```

2.  **Konfigurasi:**

    - Buat file `.env` dengan konfigurasi database dan variabel lingkungan lainnya.

      ```
      NODE_ENV=
      DB_HOST=
      DB_USER=
      DB_PASS=
      DB_NAME=
      PORT=
      ```

    - Sesuaikan konfigurasi PM2 di `ecosystem.config.js` sesuai kebutuhan.

## Cara Menjalankan Aplikasi

### Development

- mode _development server_:

  ```bash
  npm run dev
  ```

### Production

1. Build _production assets_:

   ```bash
   npm run build
   ```

2. Buat Instance pada _production server_:
   ```bash
   npm run prod
   ```

## Kontribusi

Jika Anda ingin berkontribusi pada proyek ini

## Lisensi

MIT
