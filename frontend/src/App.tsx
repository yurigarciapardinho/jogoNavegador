import React from 'react'
import { usarEstadoJogo } from './store/estadoJogo'
import TelaAldeia from './components/TelaAldeia'
import TelaMapa from './components/TelaMapa'
import TelaLogin from './components/TelaLogin'
import TelaRelatorios from './components/TelaRelatorios'
import GerenciadorNotificacoes from './components/GerenciadorNotificacoes'

const App: React.FC = () => {
    const { telaAtual, definirTela, token, usuario, realizarLogout } = usarEstadoJogo()

    if (!token) {
        return (
            <>
                <GerenciadorNotificacoes />
                <TelaLogin />
            </>
        )
    }

    const renderizarTela = () => {
        switch (telaAtual) {
            case 'aldeia':
                return <TelaAldeia />
            case 'mapa':
                return <TelaMapa />
            case 'relatorios':
                return <TelaRelatorios />
            default:
                return <TelaAldeia />
        }
    }

    return (
        <div className="aplicativoRaiz">
            <GerenciadorNotificacoes />
            <header className="cabecalhoJogo">
                <div className="cabecalhoJogo_areaLogo">
                    <div className="cabecalhoJogo_logo">TW2 Clone</div>
                    {usuario && <span className="cabecalhoJogo_nomeJogador">Senhor(a) {usuario.nomeUsuario}</span>}
                </div>
                <nav className="navegacaoPrincipal">
                    <button 
                        onClick={() => definirTela('aldeia')}
                        className={`botaoGeral ${telaAtual === 'aldeia' ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                    >
                        Aldeia
                    </button>
                    <button 
                        onClick={() => definirTela('mapa')}
                        className={`botaoGeral ${telaAtual === 'mapa' ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                    >
                        Mapa
                    </button>
                    <button 
                        onClick={() => definirTela('relatorios')}
                        className={`botaoGeral ${telaAtual === 'relatorios' ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                    >
                        Relatórios
                    </button>
                    <button 
                        onClick={realizarLogout}
                        className="botaoGeral botaoGeral--perigo"
                        title="Sair"
                    >
                        Sair
                    </button>
                </nav>
            </header>
            
            <main className="conteudoPrincipal">
                {renderizarTela()}
            </main>
        </div>
    )
}

export default App
