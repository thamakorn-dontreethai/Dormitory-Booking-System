import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const apiPort = env.PORT || 3002

    return {
        server: {
            allowedHosts: true,
            host: true,
            proxy: {
                '/api': {
                    target: `http://127.0.0.1:${apiPort}`,
                    changeOrigin: true,
                    secure: false,
                }
            }
        },
        plugins: [react()],
    }
})
