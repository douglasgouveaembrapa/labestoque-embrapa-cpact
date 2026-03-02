"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Package, PlusCircle, 
  MinusCircle, Search, Save, Database, FlaskConical, X, FileText, Download, ShieldAlert 
} from 'lucide-react';
import { supabase } from './supabaseClient';

// Importação das bibliotecas de PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Tipos ---
type Item = {
  reagente: string;
  laboratorio: string;
  cas: string;
  quantidade: number;
  unidade: string;
  validade: string;
  lote: string;
  situacao: string;
  controlado_por: string;
};

// Tipo para o Relatório
type Historico = {
  id: number;
  data_movimentacao: string;
  tipo: string;
  reagente: string;
  lote: string;
  quantidade: number;
  responsavel: string;
  laboratorio: string;
  controlado_por: string;
};

export default function SistemaEstoqueSupabase() {
  const [items, setItems] = useState<Item[]>([]);
  const [logs, setLogs] = useState<Historico[]>([]); 
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'Estoque' | 'movimentacao'>('dashboard');
  
  // Filtros Estoque
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLab, setSelectedLab] = useState('Todos');

  // Filtros Relatório (Dashboard)
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Busca Movimentação
  const [reagenteBusca, setReagenteBusca] = useState('');
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [itemSelecionadoRef, setItemSelecionadoRef] = useState<Item | null>(null);

  const [form, setForm] = useState({
    tipo: 'Entrada' as 'Entrada' | 'Saída' | 'Cadastro',
    quantidade: 0,
    responsavel: '',
    novoReagente: '',
    novoLab: '',
    novoCas: '',
    novoUnidade: 'g',
    novoLote: '',
    novoValidade: '',
    novoSituacao: 'Ok',
    novoControladoPor: 'Não controlado'
  });

  // Função para buscar Estoque (paginação)
  async function fetchEstoque() {
    setLoading(true);
    let todosDados: Item[] = [];
    let de = 0;
    let para = 999;
    let continuaBuscando = true;

    try {
      while (continuaBuscando) {
        const { data, error } = await supabase
          .from('Estoque')
          .select('*')
          .order('reagente', { ascending: true })
          .range(de, para);

        if (error) throw error;

        if (data) {
          todosDados = [...todosDados, ...data];
          if (data.length < 1000) continuaBuscando = false;
          else { de += 1000; para += 1000; }
        }
      }
      setItems(todosDados);
    } catch (error: any) {
      alert('Erro ao sincronizar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Busca o Histórico
  async function fetchHistorico() {
    const { data, error } = await supabase
      .from('historico')
      .select('*')
      .order('data_movimentacao', { ascending: false })
      .limit(500);

    if (!error && data) {
      setLogs(data);
    } else if (error) {
      console.error("Erro ao buscar histórico:", error.message);
    }
  }

  useEffect(() => { 
    fetchEstoque(); 
    fetchHistorico();
  }, []);

  const trocarAba = (novoTipo: 'Entrada' | 'Saída' | 'Cadastro') => {
    setReagenteBusca('');
    setMostrarSugestoes(false);
    setItemSelecionadoRef(null);
    setForm({
      tipo: novoTipo,
      quantidade: 0,
      responsavel: '',
      novoReagente: '',
      novoLab: '',
      novoCas: '',
      novoUnidade: 'g',
      novoLote: '',
      novoValidade: '',
      novoSituacao: 'Ok',
      novoControladoPor: 'Não controlado'
    });
  };

  const registrarLog = async (tipo: string, reagente: string, lote: string, qtd: number, resp: string, lab: string, controlado: string) => {
    const { error } = await supabase.from('historico').insert([{
      data_movimentacao: new Date().toISOString(),
      tipo: tipo,
      reagente: reagente,
      lote: lote,
      quantidade: qtd,
      responsavel: resp,
      laboratorio: lab,
      controlado_por: controlado || 'Não controlado' 
    }]);

    if (error) {
      alert("Erro ao salvar no histórico: " + error.message);
    } else {
      fetchHistorico();
    }
  };

  const handleSalvar = async () => {
    const acaoTexto = form.tipo === 'Cadastro' ? 'CADASTRAR este novo reagente' : `confirmar esta ${form.tipo}`;
    if (!window.confirm(`Tem certeza que deseja ${acaoTexto}?`)) return;

    if (form.tipo === 'Cadastro') {
      if (!form.novoReagente || !form.novoLab || !form.novoCas || !form.responsavel) {
        return alert("⚠️ Preencha todos os campos obrigatórios (*)");
      }

      const { error } = await supabase.from('Estoque').insert([{
        reagente: form.novoReagente,
        laboratorio: form.novoLab,
        cas: form.novoCas,
        quantidade: form.quantidade,
        unidade: form.novoUnidade,
        lote: form.novoLote,
        validade: form.novoValidade,
        situacao: form.novoSituacao,
        controlado_por: form.novoControladoPor
      }]);

      if (error) alert("Erro ao cadastrar: " + error.message);
      else {
        await registrarLog(
          'Cadastro', 
          form.novoReagente, 
          form.novoLote, 
          form.quantidade, 
          form.responsavel, 
          form.novoLab, 
          form.novoControladoPor
        );
        alert("Novo reagente cadastrado com sucesso!");
        trocarAba('Cadastro');
        fetchEstoque();
      }
    } else {
      if (!itemSelecionadoRef || form.quantidade <= 0 || !form.responsavel) {
        return alert("⚠️ Selecione o reagente na lista e informe a quantidade/responsável.");
      }

      let novaQtd = Number(itemSelecionadoRef.quantidade);
      if (form.tipo === 'Saída') {
        if (novaQtd < form.quantidade) return alert("Saldo insuficiente em estoque!");
        novaQtd -= form.quantidade;
      } else {
        novaQtd += form.quantidade;
      }

      const { error } = await supabase
        .from('Estoque')
        .update({ quantidade: novaQtd })
        .match({ 
          reagente: itemSelecionadoRef.reagente, 
          laboratorio: itemSelecionadoRef.laboratorio,
          lote: itemSelecionadoRef.lote 
        });

      if (error) alert("Erro ao atualizar banco: " + error.message);
      else {
        const controleLog = itemSelecionadoRef.controlado_por || 'Não controlado';
        
        await registrarLog(
          form.tipo, 
          itemSelecionadoRef.reagente, 
          itemSelecionadoRef.lote, 
          form.quantidade, 
          form.responsavel, 
          itemSelecionadoRef.laboratorio,
          controleLog
        );
        alert(`${form.tipo} realizada! Novo saldo: ${novaQtd}`);
        trocarAba(form.tipo);
        fetchEstoque();
      }
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const matchLab = selectedLab === 'Todos' || i.laboratorio === selectedLab;
      const term = searchTerm.toLowerCase();
      const nomeReagente = (i.reagente || "").toLowerCase();
      const numCas = (i.cas || "").toLowerCase();
      const numLote = (i.lote || "").toLowerCase();
      return matchLab && (nomeReagente.includes(term) || numCas.includes(term) || numLote.includes(term));
    });
  }, [items, searchTerm, selectedLab]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (!dataInicio && !dataFim) return true;
      const dataLog = new Date(log.data_movimentacao).toISOString().split('T')[0];
      const inicio = dataInicio || '0000-01-01';
      const fim = dataFim || '9999-12-31';
      return dataLog >= inicio && dataLog <= fim;
    });
  }, [logs, dataInicio, dataFim]);

  const gerarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório de Movimentação de Estoque", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 28);
    if(dataInicio || dataFim) {
      doc.text(`Período: ${dataInicio ? new Date(dataInicio).toLocaleDateString('pt-BR') : 'Início'} até ${dataFim ? new Date(dataFim).toLocaleDateString('pt-BR') : 'Hoje'}`, 14, 34);
    }

    const tabelaDados = filteredLogs.map(log => [
      new Date(log.data_movimentacao).toLocaleDateString('pt-BR') + ' ' + new Date(log.data_movimentacao).toLocaleTimeString('pt-BR'),
      log.tipo,
      log.reagente,
      log.lote,
      log.quantidade,
      log.laboratorio,
      log.controlado_por || 'Não controlado',
      log.responsavel
    ]);

    autoTable(doc, {
      head: [['Data/Hora', 'Tipo', 'Reagente', 'Lote', 'Qtd', 'Laboratório', 'Controle', 'Responsável']],
      body: tabelaDados,
      startY: 40,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [0, 69, 134] },
    });

    doc.save("relatorio_estoque.pdf");
  };

  const sugestoesBusca = useMemo(() => {
    const termo = reagenteBusca.toLowerCase();
    if (!termo) return items.slice(0, 100);
    return items.filter(i => 
      (i.reagente || "").toLowerCase().includes(termo) || 
      (i.lote || "").toLowerCase().includes(termo) ||
      (i.cas || "").toLowerCase().includes(termo)
    ).slice(0, 100);
  }, [reagenteBusca, items]);

  const labsDisponiveis = useMemo(() => Array.from(new Set(items.map(i => i.laboratorio))).sort(), [items]);
  const Req = () => <span className="text-red-500 ml-1 font-bold">*</span>;

  if (loading && items.length === 0) return <div className="p-10 text-center text-blue-600 font-bold italic animate-pulse">Sincronizando Sistema...</div>;

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans text-slate-800">
      
      <aside className="w-64 bg-[#004586] text-white flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold flex items-center gap-2"><FlaskConical /> LabEstoque</h1>
          <p className="text-xs text-slate-300 mt-1 uppercase">Embrapa Clima Temperado</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${view === 'dashboard' ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => setView('Estoque')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${view === 'Estoque' ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}>
            <Package size={20} /> Estoque Geral
          </button>
          <button onClick={() => setView('movimentacao')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${view === 'movimentacao' ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}>
            <PlusCircle size={20} /> Gestão / Lançamentos
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        
        {view === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-700">Painel de Controle</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-blue-600">
                <h3 className="text-slate-500 text-xs font-bold uppercase">Total de Itens</h3>
                <p className="text-4xl font-bold">{items.length}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-red-500">
                <h3 className="text-slate-500 text-xs font-bold uppercase">Vencidos</h3>
                <p className="text-4xl font-bold text-red-600">{items.filter(i => i.situacao?.toLowerCase() === 'vencido').length}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-green-500">
                <h3 className="text-slate-500 text-xs font-bold uppercase">Laboratórios</h3>
                <p className="text-4xl font-bold text-green-600">{labsDisponiveis.length}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 mt-6">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-700">
                  <FileText className="text-blue-600" /> Relatório de Movimentações
                </h3>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">De:</span>
                      <input 
                        type="date" 
                        className="bg-white border rounded px-2 py-1 text-sm outline-none focus:border-blue-500 text-slate-600"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">Até:</span>
                      <input 
                        type="date" 
                        className="bg-white border rounded px-2 py-1 text-sm outline-none focus:border-blue-500 text-slate-600"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                      />
                    </div>
                    {(dataInicio || dataFim) && (
                      <button onClick={() => {setDataInicio(''); setDataFim('')}} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <X size={16}/>
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={gerarPDF}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition shadow-sm font-bold text-sm"
                  >
                    <Download size={16} /> Baixar PDF
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Data/Hora</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Reagente</th>
                      <th className="p-3">Lote</th>
                      <th className="p-3 text-right">Qtd</th>
                      <th className="p-3">Laboratório</th>
                      <th className="p-3">Controle</th>
                      <th className="p-3">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-slate-500 text-xs">
                          {new Date(log.data_movimentacao).toLocaleDateString('pt-BR')} <br/>
                          <span className="text-[10px]">{new Date(log.data_movimentacao).toLocaleTimeString('pt-BR')}</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                            log.tipo === 'Entrada' ? 'bg-green-100 text-green-700' :
                            log.tipo === 'Saída' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {log.tipo}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-700">
                          {log.reagente}
                        </td>
                        <td className="p-3 text-xs text-slate-500">{log.lote}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-700">{log.quantidade}</td>
                        <td className="p-3 text-xs text-slate-600">{log.laboratorio}</td>
                        <td className="p-3 text-xs">
                           {log.controlado_por && log.controlado_por !== 'Não controlado' ? (
                             <span className="text-red-600 font-bold flex items-center gap-1">
                               <ShieldAlert size={10} /> {log.controlado_por}
                             </span>
                           ) : (
                             <span className="text-slate-400">Não controlado</span>
                           )}
                        </td>
                        <td className="p-3 text-xs text-slate-600 capitalize">{log.responsavel}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                          Nenhuma movimentação encontrada neste período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === 'Estoque' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-700">Estoque Geral</h2>
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col md:flex-row gap-4">
              <input type="text" className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Buscar por Nome, CAS ou Lote..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <select className="border rounded-lg px-3 py-2 bg-slate-50 text-sm" value={selectedLab} onChange={e => setSelectedLab(e.target.value)}>
                <option value="Todos">Todos os Laboratórios</option>
                {labsDisponiveis.map(lab => <option key={lab} value={lab}>{lab}</option>)}
              </select>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-4 border-r text-center">Laboratório</th>
                    <th className="p-4">Reagente / CAS</th>
                    <th className="p-4">Controle</th>
                    <th className="p-4">Lote</th>
                    <th className="p-4 text-right">Saldo</th>
                    <th className="p-4 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => (
                    <tr key={`${item.reagente}-${item.lote}-${idx}`} className="hover:bg-blue-50/20 transition">
                      <td className="p-4 text-[10px] font-bold text-blue-800 uppercase border-r bg-slate-50/50 text-center">{item.laboratorio}</td>
                      <td className="p-4 font-medium">
                        {item.reagente} 
                        <br/>
                        <span className="text-[10px] text-slate-400 font-normal italic">CAS: {item.cas || '-'}</span>
                      </td>
                      <td className="p-4">
                        {/* AQUI ESTÁ A CORREÇÃO DE "LIVRES" PARA "NÃO CONTROLADO" */}
                        {item.controlado_por && item.controlado_por !== 'Não controlado' ? (
                          <div className="flex items-center gap-1 text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded w-fit border border-red-100">
                            <ShieldAlert size={12} /> {item.controlado_por}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">Não controlado</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500 text-xs italic">{item.lote || '-'}</td>
                      <td className="p-4 text-right font-mono font-bold">{item.quantidade} <span className="text-[10px] font-normal text-slate-400">{item.unidade}</span></td>
                      <td className="p-4 text-center">
                        <span 
                          title={item.validade ? `Data de Validade: ${item.validade}` : 'Validade não informada'}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold cursor-help ${
                            item.situacao?.toLowerCase() === 'vencido' 
                            ? 'bg-red-100 text-red-600 border border-red-200' 
                            : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {item.situacao}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'movimentacao' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-slate-700 text-center uppercase">Gestão de Lançamentos</h2>
            <div className="bg-white p-8 rounded-2xl shadow-xl border">
              <div className="grid grid-cols-3 gap-4 mb-8">
                <button onClick={() => trocarAba('Entrada')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${form.tipo === 'Entrada' ? 'bg-green-50 border-green-500 text-green-700 font-bold' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <PlusCircle size={24} /> Entrada
                </button>
                <button onClick={() => trocarAba('Saída')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${form.tipo === 'Saída' ? 'bg-orange-50 border-orange-500 text-orange-700 font-bold' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <MinusCircle size={24} /> Saída
                </button>
                <button onClick={() => trocarAba('Cadastro')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${form.tipo === 'Cadastro' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <FlaskConical size={24} /> Novo Item
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {form.tipo === 'Cadastro' ? (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold mb-1">Nome do Reagente<Req/></label>
                      <input type="text" className="w-full p-3 border rounded-xl" placeholder="Nome do material" value={form.novoReagente} onChange={e => setForm({...form, novoReagente: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-1">Laboratório<Req/></label>
                      <input type="text" className="w-full p-2.5 border rounded-lg" placeholder="Ex: Fitopatologia" value={form.novoLab} onChange={e => setForm({...form, novoLab: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-1">Número CAS<Req/></label>
                      <input type="text" className="w-full p-2.5 border rounded-lg" placeholder="00-00-0" value={form.novoCas} onChange={e => setForm({...form, novoCas: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-bold mb-1">Saldo Inicial</label>
                            <input type="number" className="w-full p-2.5 border rounded-lg" value={form.quantidade || ''} onChange={e => setForm({...form, quantidade: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Unidade</label>
                            <select className="w-full p-2.5 border rounded-lg bg-white" value={form.novoUnidade} onChange={e => setForm({...form, novoUnidade: e.target.value})}>
                                <option value="g">g</option>
                                <option value="ml">ml</option>
                                <option value="unidade">unidade</option>
                            </select>
                        </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-1">Lote</label>
                      <input type="text" className="w-full p-2.5 border rounded-lg" value={form.novoLote} onChange={e => setForm({...form, novoLote: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">Validade</label>
                        <input type="text" className="w-full p-2.5 border rounded-lg" placeholder="DD/MM/AAAA" value={form.novoValidade} onChange={e => setForm({...form, novoValidade: e.target.value})} />
                    </div>
                    
                    {/* CAMPO NOVO (RESTAURADO) */}
                    <div>
                      <label className="block text-sm font-bold mb-1 text-red-700">Controlado Por</label>
                      <select className="w-full p-2.5 border rounded-lg bg-red-50 text-red-800 font-bold" value={form.novoControladoPor} onChange={e => setForm({...form, novoControladoPor: e.target.value})}>
                        <option value="Não controlado">Não controlado</option>
                        <option value="Exército">Exército</option>
                        <option value="Polícia Federal">Polícia Federal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Situação</label>
                      <select className="w-full p-2.5 border rounded-lg bg-white" value={form.novoSituacao} onChange={e => setForm({...form, novoSituacao: e.target.value})}>
                        <option value="Ok">Ok</option>
                        <option value="Vencido">Vencido</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="md:col-span-2 relative">
                      <label className="block text-sm font-bold mb-1 text-blue-800 uppercase text-[10px] tracking-widest">Item e Lote no Estoque<Req/></label>
                      <div className="relative">
                        <input 
                          type="text" 
                          className="w-full p-3 border-2 border-blue-100 rounded-xl bg-white outline-none focus:border-blue-500 shadow-sm" 
                          placeholder="Digite nome, lote ou CAS para filtrar..." 
                          value={reagenteBusca}
                          onFocus={() => setMostrarSugestoes(true)}
                          onChange={e => { 
                            setReagenteBusca(e.target.value); 
                            setMostrarSugestoes(true);
                            if(itemSelecionadoRef) setItemSelecionadoRef(null);
                          }}
                        />
                        {reagenteBusca && (
                          <button onClick={() => { setReagenteBusca(''); setItemSelecionadoRef(null); }} className="absolute right-3 top-3.5 text-slate-400 hover:text-red-500"><X size={20}/></button>
                        )}
                      </div>

                      {mostrarSugestoes && (
                        <div className="absolute z-50 w-full bg-white border-2 border-blue-50 rounded-xl shadow-2xl mt-1 max-h-64 overflow-y-auto">
                          {sugestoesBusca.map((item, idx) => (
                            <button key={idx} className="w-full text-left p-3 hover:bg-blue-50 border-b last:border-0 flex flex-col transition"
                              onClick={() => {
                                setItemSelecionadoRef(item);
                                setReagenteBusca(`${item.reagente} (Lote: ${item.lote || '-'}) [${item.laboratorio}]`);
                                setMostrarSugestoes(false);
                              }}>
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-slate-800">{item.reagente}</span>
                                <span className="bg-blue-700 text-white text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">{item.laboratorio}</span>
                              </div>
                              <div className="flex justify-between items-center mt-1 text-xs text-slate-500">
                                <span>CAS: <strong>{item.cas || '-'}</strong> | Lote: <strong>{item.lote || '-'}</strong></span>
                                <span>Saldo: <strong className="text-blue-700">{item.quantidade} {item.unidade}</strong></span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold mb-1 uppercase text-[10px] tracking-widest">Quantidade da {form.tipo}<Req/></label>
                      <input 
                        type="number" 
                        className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500" 
                        value={form.quantidade || ''} 
                        placeholder="0"
                        onChange={e => setForm({...form, quantidade: Number(e.target.value)})} 
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold mb-1 uppercase text-[10px] tracking-widest">Responsável pela Ação<Req/></label>
                  <input type="text" className="w-full p-3 border rounded-xl outline-none focus:border-blue-500" placeholder="Seu nome" value={form.responsavel} onChange={e => setForm({...form, responsavel: e.target.value})} />
                </div>

                <button onClick={handleSalvar} className="md:col-span-2 bg-[#004586] text-white font-bold py-4 rounded-2xl mt-4 flex items-center justify-center gap-2 hover:bg-blue-800 transition shadow-lg active:scale-95 uppercase tracking-widest text-sm">
                  <Save size={20} /> Confirmar Lançamento
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}