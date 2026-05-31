import React from 'react'
import { usarEstadoJogo } from './store/estadoJogo'
import TelaAldeia from './components/TelaAldeia'
import TelaMapa from './components/TelaMapa'
import TelaLogin from './components/TelaLogin'
import TelaRelatorios from './components/TelaRelatorios'
import TelaAdministracao from './components/admin/TelaAdministracao'
import GerenciadorNotificacoes from './components/GerenciadorNotificacoes'
import VigiaDeBatalha from './components/VigiaDeBatalha'
import TelaDerrota from './components/TelaDerrota'

const App: React.FC = () => {
    const { telaAtual, definirTela, token, usuario, realizarLogout, mensagemGlobal, isDefeated, sincronizarAldeiaSilenciosa } = usarEstadoJogo()

    React.useEffect(() => {
        if (!token) return
        
        sincronizarAldeiaSilenciosa()
        const intervalo = setInterval(() => {
            sincronizarAldeiaSilenciosa()
        }, 15000)
        
        return () => clearInterval(intervalo)
    }, [token])

    if (token && isDefeated) {
        return <TelaDerrota />
    }

    if (!token) {
        return (
            <div className="aplicativoRaiz">
                <GerenciadorNotificacoes />
                <TelaLogin />
            </div>
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
            case 'admin':
                return <TelaAdministracao />
            default:
                return <TelaAldeia />
        }
    }

    return (
        <div className="aplicativoRaiz">
            <GerenciadorNotificacoes />
            <VigiaDeBatalha />
            
            {mensagemGlobal && (
                <div style={{ backgroundColor: '#b91c1c', color: 'white', padding: '10px', textAlign: 'center', fontWeight: 'bold', borderBottom: '2px solid #7f1d1d' }}>
                    📢 AVISO GLOBAL: {mensagemGlobal}
                </div>
            )}
            
            <header className="cabecalhoJogo">
                <div className="cabecalhoJogo_areaLogo">
                    <div className="cabecalhoJogo_logo">TW2 Clone</div>
                    {usuario && <span className="cabecalhoJogo_nomeJogador">Senhor(a) {usuario.nomeUsuario}</span>}
                </div>
                <nav className="navegacaoPrincipal">
                    {usuario?.role !== 'ADMIN' && (
                        <>
                            <button 
                                onClick={() => definirTela('aldeia')}
                                className={`botaoGeral ${telaAtual === 'aldeia' ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                            >
                                Aldeia
                            </button>
                            <button 
                                onClick={() => definirTela('relatorios')}
                                className={`botaoGeral ${telaAtual === 'relatorios' ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                            >
                                Relatórios
                            </button>
                        </>
                    )}
                    <button 
                        onClick={() => definirTela('mapa')}
                        className={`botaoGeral ${telaAtual === 'mapa' ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                    >
                        Mapa
                    </button>
                    {usuario?.role === 'ADMIN' && (
                        <button 
                            onClick={() => definirTela('admin')}
                            className={`botaoGeral ${telaAtual === 'admin' ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                            style={{ border: '2px solid var(--corSucesso)' }}
                        >
                            Painel Admin
                        </button>
                    )}
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
