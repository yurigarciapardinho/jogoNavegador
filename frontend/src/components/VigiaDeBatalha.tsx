import React, { useEffect, useRef } from 'react'
import { usarEstadoJogo } from '../store/estadoJogo'
import { api } from '../api'

export default function VigiaDeBatalha() {
    const { token, adicionarNotificacao } = usarEstadoJogo()
    const qtdRelatorios = useRef<number>(-1)

    useEffect(() => {
        if (!token) return

        const checarRelatorios = async () => {
            try {
                const dados = await api.get('/reports', token)
                
                if (qtdRelatorios.current !== -1 && dados.length > qtdRelatorios.current) {
                    adicionarNotificacao('⚔️ Novo Relatório de Batalha recebido!', 'info')
                }
                
                qtdRelatorios.current = dados.length
            } catch (e) {
                // silencioso
            }
        }

        checarRelatorios()
        const interval = setInterval(checarRelatorios, 5000)

        return () => clearInterval(interval)
    }, [token, adicionarNotificacao])

    return null // Componente invisível
}
