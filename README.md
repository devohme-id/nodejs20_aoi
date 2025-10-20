# Smart AOI Dashboard

Smart AOI Dashboard adalah aplikasi Node.js yang menyediakan dasbor untuk memantau dan menganalisis data dari sistem Automated Optical Inspection (AOI). Aplikasi ini menggunakan server-sent events (SSE) untuk mengirimkan pembaruan real-time ke klien yang terhubung.

## Fitur

*   **Dasbor Real-time:** Menampilkan data AOI secara real-time.
*   **Server-Sent Events (SSE):** Menggunakan SSE untuk mengirimkan pembaruan data ke klien tanpa perlu polling.
*   **Konfigurasi PM2:** Konfigurasi PM2 untuk memastikan aplikasi berjalan dengan stabil dan dapat diandalkan.
*   **Penanganan Kesalahan:** Penanganan kesalahan global untuk mencatat dan melaporkan kesalahan yang terjadi.

## Cara Penggunaan

1.  **Instalasi:**

    ```bash
    npm install
    ```

2.  **Konfigurasi:**

    *   Buat file `.env` dengan konfigurasi database dan variabel lingkungan lainnya.
    *   Sesuaikan konfigurasi PM2 di `ecosystem.config.js` sesuai kebutuhan.

3.  **Menjalankan Aplikasi:**

    ```bash
    npm start
    ```

## Kontribusi

Jika Anda ingin berkontribusi pada proyek ini, silakan fork repositori dan kirim pull request.

## Lisensi

MIT
