import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import App from './App'
import './index.css'

dayjs.locale('es')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={esES}
      theme={{
        token: {
          colorPrimary: '#1A569E',
          colorLink: '#1A569E',
          borderRadius: 8,
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
        },
        components: {
          Layout: {
            siderBg: '#001529',
            triggerBg: '#002140',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
