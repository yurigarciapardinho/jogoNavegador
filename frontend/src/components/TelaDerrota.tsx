import React, { useState } from 'react'
import { api } from '../api'
import { usarEstadoJogo } from '../store/estadoJogo'

export default function TelaDerrota() {
    const { token, adicionarNotificacao, definirDerrota } = usarEstadoJogo()
    const [carregando, definirCarregando] = useState(false)
    const [regiao, definirRegiao] = useState('ALEATORIO')

    const recomecar = async () => {
        if (carregando) return
        definirCarregando(true)
        try {
            await api.post('/me/restart', { region: regiao }, token)
            definirDerrota(false)
            adicionarNotificacao('Você renasceu das cinzas com uma nova aldeia!', 'sucesso')
            window.location.reload()
        } catch (erro: any) {
            adicionarNotificacao(erro.message || 'Erro ao tentar recomeçar.', 'erro')
            definirCarregando(false)
        }
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: '#000', color: '#fff', display: 'flex',
            flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }}>
            <h1 style={{ color: '#dc2626', fontSize: '3rem', marginBottom: '1rem', textShadow: '2px 2px 4px #000' }}>
                DERROTA
            </h1>
            <p style={{ fontSize: '1.5rem', marginBottom: '2rem', maxWidth: '800px', textAlign: 'center', lineHeight: '1.5', fontStyle: 'italic', color: '#ccc' }}>
                "Todos os seus soldados foram mortos, os cidadãos foram queimados e os poucos que sobraram fugiram para longe. Seu império desmoronou em cinzas e sangue..."
            </p>
            
            <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <label style={{ marginBottom: '0.5rem', color: '#ccc', fontSize: '1.2rem' }}>Escolha a região para o novo império:</label>
                <select 
                    value={regiao} 
                    onChange={(e) => definirRegiao(e.target.value)} 
                    style={{ padding: '10px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #dc2626', backgroundColor: '#111', color: '#fff', outline: 'none' }}
                >
                    <option value="ALEATORIO">Aleatório (Padrão)</option>
                    <option value="NO">Noroeste (NO)</option>
                    <option value="N">Norte (N)</option>
                    <option value="NE">Nordeste (NE)</option>
                    <option value="O">Oeste (O)</option>
                    <option value="L">Leste (L)</option>
                    <option value="SO">Sudoeste (SO)</option>
                    <option value="S">Sul (S)</option>
                    <option value="SE">Sudeste (SE)</option>
                </select>
            </div>
            
            <button 
                onClick={recomecar}
                disabled={carregando}
                className="botaoGeral botaoGeral--primario"
                style={{ fontSize: '1.25rem', padding: '16px 32px' }}
            >
                {carregando ? 'Recomeçando...' : 'Recomeçar do Zero'}
            </button>
        </div>
    )
}
