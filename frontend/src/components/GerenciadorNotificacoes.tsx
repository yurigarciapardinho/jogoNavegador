import React from 'react'
import { usarEstadoJogo } from '../store/estadoJogo'

export default function GerenciadorNotificacoes() {
    const { notificacoes, removerNotificacao } = usarEstadoJogo()

    if (notificacoes.length === 0) return null

    return (
        <div className="gerenciadorNotificacoes">
            {notificacoes.map(notificacao => (
                <div 
                    key={notificacao.id} 
                    className={`notificacaoItem notificacaoItem--${notificacao.tipo}`}
                >
                    <span className="notificacaoMensagem">{notificacao.mensagem}</span>
                    <button 
                        onClick={() => removerNotificacao(notificacao.id)}
                        className="botaoFecharNotificacao"
                        aria-label="Fechar notificação"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    )
}
