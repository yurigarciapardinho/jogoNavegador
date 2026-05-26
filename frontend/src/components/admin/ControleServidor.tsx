import React, { useState, useEffect } from 'react'
import { api } from '../../api'
import { usarEstadoJogo } from '../../store/estadoJogo'
import { ServerCrash, AlertOctagon, Skull, Settings, Save, DatabaseBackup, Activity } from 'lucide-react'

const ControleServidor: React.FC = () => {
    const { token, adicionarNotificacao } = usarEstadoJogo()
    
    // Configurações
    const [maintenanceMode, setMaintenanceMode] = useState(false)
    const [speedMultiplier, setSpeedMultiplier] = useState(1.0)
    const [globalMessage, setGlobalMessage] = useState('')
    const [salvandoConfig, setSalvandoConfig] = useState(false)

    // Modais e Senhas
    const [modalAcao, setModalAcao] = useState<'wipe' | 'backup' | null>(null)
    const [senhaDigitada, setSenhaDigitada] = useState('')
    const [executando, definirExecutando] = useState(false)

    useEffect(() => {
        carregarConfig()
    }, [])

    const carregarConfig = async () => {
        try {
            const config = await api.get('/admin/config', token)
            setMaintenanceMode(config.maintenanceMode)
            setSpeedMultiplier(config.speedMultiplier)
            setGlobalMessage(config.globalMessage || '')
        } catch (erro) {
            adicionarNotificacao('Erro ao carregar configurações do servidor', 'erro')
        }
    }

    const salvarConfig = async () => {
        setSalvandoConfig(true)
        try {
            await api.put('/admin/config', {
                maintenanceMode,
                speedMultiplier,
                globalMessage: globalMessage.trim() || null
            }, token)
            adicionarNotificacao('Configurações atualizadas e ativas imediatamente.', 'sucesso')
        } catch (erro: any) {
            adicionarNotificacao('Erro ao salvar config: ' + erro.message, 'erro')
        } finally {
            setSalvandoConfig(false)
        }
    }

    const executarAcaoCritica = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!senhaDigitada) return

        definirExecutando(true)
        try {
            if (modalAcao === 'wipe') {
                await api.post('/admin/db/wipe', { password: senhaDigitada }, token)
                adicionarNotificacao('O servidor foi obliterado com sucesso.', 'sucesso')
            } else if (modalAcao === 'backup') {
                const res = await api.post('/admin/db/backup', { password: senhaDigitada }, token)
                adicionarNotificacao(`Backup criado com sucesso: ${res.file}`, 'sucesso')
            }
            setModalAcao(null)
            setSenhaDigitada('')
        } catch (erro: any) {
            adicionarNotificacao('Falha na autenticação ou execução: ' + erro.message, 'erro')
        } finally {
            definirExecutando(false)
        }
    }

    return (
        <div style={{ height: '100%' }}>
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ color: 'white', margin: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ServerCrash size={24} color="#f44336" /> Controle de Servidor
                </h2>
                <p style={{ color: '#aaa', fontSize: '14px', marginTop: '5px' }}>Gerencie as regras globais e execute manutenções críticas de banco de dados.</p>
            </div>

            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                {/* Painel de Configurações Dinâmicas */}
                <div style={{ flex: 1, minWidth: '350px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '25px' }}>
                    <h3 style={{ color: '#fff', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
                        <Settings size={20} color="#4CAF50" /> Configurações em Tempo Real
                    </h3>
                    
                    <div style={{ marginTop: '20px' }}>
                        <label style={{ display: 'block', color: '#ccc', marginBottom: '8px' }}>
                            Modo de Manutenção (Bloqueia jogadores)
                        </label>
                        <select 
                            value={maintenanceMode ? 'sim' : 'nao'} 
                            onChange={e => setMaintenanceMode(e.target.value === 'sim')}
                            style={{ width: '100%', padding: '10px', backgroundColor: '#222', color: 'white', border: '1px solid #444', borderRadius: '6px' }}
                        >
                            <option value="nao">Desativado (Servidor Aberto)</option>
                            <option value="sim">Ativado (Apenas Admins Acessam)</option>
                        </select>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <label style={{ display: 'block', color: '#ccc', marginBottom: '8px' }}>
                            Multiplicador de Velocidade (Recursos, Fila, Movimento)
                        </label>
                        <input 
                            type="number" step="0.1" min="0.1" max="100"
                            value={speedMultiplier} 
                            onChange={e => setSpeedMultiplier(parseFloat(e.target.value) || 1)}
                            style={{ width: '100%', padding: '10px', backgroundColor: '#222', color: 'white', border: '1px solid #444', borderRadius: '6px' }}
                        />
                        <small style={{ color: '#888' }}>1.0 é a velocidade base. 2.0 = 2x mais rápido.</small>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <label style={{ display: 'block', color: '#ccc', marginBottom: '8px' }}>
                            Aviso Global em Banner
                        </label>
                        <input 
                            type="text"
                            value={globalMessage} 
                            onChange={e => setGlobalMessage(e.target.value)}
                            placeholder="Ex: Evento de 2x Velocidade ativado!"
                            style={{ width: '100%', padding: '10px', backgroundColor: '#222', color: 'white', border: '1px solid #444', borderRadius: '6px' }}
                        />
                    </div>

                    <button 
                        onClick={salvarConfig}
                        disabled={salvandoConfig}
                        className="botaoGeral"
                        style={{ marginTop: '20px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px' }}
                    >
                        <Save size={18} /> {salvandoConfig ? 'Salvando...' : 'Aplicar Configurações'}
                    </button>
                </div>

                {/* Painel de Risco (Banco de Dados) */}
                <div style={{ flex: 1, minWidth: '350px', backgroundColor: 'rgba(244, 67, 54, 0.05)', border: '1px solid rgba(244, 67, 54, 0.2)', borderRadius: '16px', padding: '25px' }}>
                    <h3 style={{ color: '#E57373', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(244, 67, 54, 0.2)', paddingBottom: '15px' }}>
                        <DatabaseBackup size={20} /> Gestão de Banco de Dados
                    </h3>
                    
                    <p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.6', marginTop: '20px' }}>
                        Execute backups de segurança (salvos na pasta /backups do backend) ou reinicie todo o universo do zero. Ambas as ações exigem sua senha de administrador.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
                        <button 
                            onClick={() => setModalAcao('backup')}
                            className="botaoGeral"
                            style={{ background: 'rgba(33, 150, 243, 0.1)', border: '1px solid #2196F3', color: '#2196F3', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', width: '100%' }}
                        >
                            <Save size={18} /> Gerar Backup Seguro (pg_dump)
                        </button>

                        <button 
                            onClick={() => setModalAcao('wipe')}
                            className="botaoGeral"
                            style={{ background: 'rgba(244, 67, 54, 0.2)', border: '1px solid #f44336', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', width: '100%', textTransform: 'uppercase' }}
                        >
                            <Skull size={18} /> Wipe Global (Apocalipse)
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Confirmação Extrema com Senha */}
            {modalAcao && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20, 0, 0, 0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <form onSubmit={executarAcaoCritica} style={{ backgroundColor: '#111', border: modalAcao === 'wipe' ? '1px solid #f44336' : '1px solid #2196F3', padding: '35px', borderRadius: '16px', width: '450px', textAlign: 'center', boxShadow: modalAcao === 'wipe' ? '0 0 50px rgba(244, 67, 54, 0.4)' : '0 0 50px rgba(33, 150, 243, 0.3)' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: modalAcao === 'wipe' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(33, 150, 243, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            {modalAcao === 'wipe' ? <Skull size={32} color="#f44336" /> : <Save size={32} color="#2196F3" />}
                        </div>
                        
                        <h2 style={{ color: modalAcao === 'wipe' ? '#f44336' : '#2196F3', marginTop: 0, fontWeight: 600 }}>
                            {modalAcao === 'wipe' ? 'Aviso de Destruição Global' : 'Autorização Necessária'}
                        </h2>
                        
                        <p style={{ color: '#ccc', marginBottom: '25px', lineHeight: '1.6' }}>
                            {modalAcao === 'wipe' 
                                ? 'Você está prestes a apagar todo o banco de dados. Esta ação é irreversível.'
                                : 'Você está prestes a gerar um dump completo do banco de dados na máquina.'}
                        </p>
                        
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '10px' }}>
                                Por motivos de segurança, digite sua <strong>SENHA</strong> de administrador:
                            </label>
                            <input 
                                type="password"
                                value={senhaDigitada}
                                onChange={e => setSenhaDigitada(e.target.value)}
                                placeholder="****************"
                                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #555', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', textAlign: 'center', fontSize: '16px' }}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button type="button" onClick={() => {setModalAcao(null); setSenhaDigitada('')}} className="botaoGeral" style={{ background: 'transparent', border: '1px solid #555', color: '#ccc', flex: 1 }}>Cancelar</button>
                            <button 
                                type="submit" 
                                disabled={executando || !senhaDigitada}
                                className="botaoGeral" 
                                style={{ background: modalAcao === 'wipe' ? '#f44336' : '#2196F3', border: 'none', color: 'white', flex: 1, opacity: executando || !senhaDigitada ? 0.5 : 1 }}
                            >
                                {executando ? 'Processando...' : 'Confirmar e Executar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}

export default ControleServidor
