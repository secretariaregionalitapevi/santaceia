document.addEventListener('DOMContentLoaded', async () => {
  const config = JSON.parse(sessionStorage.getItem('recitativos_config'));
  if (!config) {
    window.location.href = '/';
    return;
  }

  const container = document.getElementById('cardsContainer');
  const summary = document.getElementById('selectionSummary');
  const datePickerRow = document.getElementById('datePickerRow');
  const selectedDateSelect = document.getElementById('selectedDate');
  const headerSubtitle = document.getElementById('headerSubtitle');

  window.updateSummaryWithName = async (user) => {
    let name = user.user_metadata?.full_name;
    
    // Se não tiver no metadata, tenta buscar na tabela rjm_auxiliares via API
    if (!name) {
      try {
        const res = await fetch(`/api/profile?id=${user.id}`);
        const profile = await res.json();
        if (profile.full_name) {
          name = profile.full_name;
        }
      } catch (err) {
        console.error('Erro ao buscar nome completo:', err);
      }
    }

    if (!name) name = user.email?.split('@')[0] || '...';

    // Capitalizar e formatar ricardograngeiro -> Ricardo Grangeiro
    if (name.toLowerCase() === 'ricardograngeiro') name = 'Ricardo Grangeiro';
    else if (name.includes('.')) name = name.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    else if (!user.user_metadata?.full_name) name = name.charAt(0).toUpperCase() + name.slice(1);

    // Salvar no escopo para o submit
    window.auxiliarFullName = name;

    summary.innerHTML = `
      <strong>Mês:</strong> ${config.mes} | 
      <strong>Município:</strong> ${config.municipio} | 
      <strong>Comum:</strong> ${config.comum} <br>
      <span style="color: var(--brand); font-weight: 700;">Nome: ${name}</span>
    `;
  };

  if (window.currentUser) {
    await window.updateSummaryWithName(window.currentUser);
  }


  function createCard(dateLabel, index) {
    const card = document.createElement('div');
    card.className = 'sunday-card';
    card.innerHTML = `
      <div class="sunday-card-title">${dateLabel}</div>
      <input type="hidden" name="date_${index}" value="${dateLabel}">
      <div class="grid-counts">
        <div class="form-group">
          <label>Meninas</label>
          <input type="number" name="meninas_${index}" min="0" value="0" required class="count-input">
        </div>
        <div class="form-group">
          <label>Meninos</label>
          <input type="number" name="meninos_${index}" min="0" value="0" required class="count-input">
        </div>
        <div class="form-group">
          <label>Total</label>
          <input type="number" name="total_presentes_${index}" value="0" readonly class="count-input total-field">
        </div>
      </div>
    `;

    // Adicionar listener para cálculo automático e UX de entrada
    const inputs = card.querySelectorAll('.count-input:not(.total-field)');
    const totalField = card.querySelector(`input[name="total_presentes_${index}"]`);
    
    inputs.forEach(input => {
      // Limpar o campo ao clicar se for 0
      input.addEventListener('focus', () => {
        if (input.value === '0') input.value = '';
      });

      // Se sair e estiver vazio, volta para 0
      input.addEventListener('blur', () => {
        if (input.value === '') {
          input.value = '0';
          // Disparar input para recalcular o total mesmo voltando para 0
          input.dispatchEvent(new Event('input'));
        }
      });

      input.addEventListener('input', () => {
        let sum = 0;
        inputs.forEach(i => sum += parseInt(i.value || 0));
        totalField.value = sum;
      });
    });

    return card;
  }

  if (config.type === 'all') {
    config.sundays.forEach((date, i) => {
      container.appendChild(createCard(`Domingo ${i + 1} (${date})`, i));
    });
  } else {
    datePickerRow.classList.remove('hidden');
    config.sundays.forEach(date => {
      const opt = document.createElement('option');
      opt.value = date;
      opt.textContent = date;
      selectedDateSelect.appendChild(opt);
    });

    selectedDateSelect.addEventListener('change', (e) => {
      container.innerHTML = '';
      if (e.target.value) {
        container.appendChild(createCard(`Data: ${e.target.value}`, 0));
      }
    });
  }

  const form = document.getElementById('recitativosForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const user = window.currentUser;
    if (!user) {
      Swal.fire('Erro', 'Você precisa estar logado para enviar.', 'error');
      return;
    }

    const formData = new FormData(form);
    const rawData = Object.fromEntries(formData.entries());
    
    // Função para converter data PT-BR (DD/MM/YYYY) para ISO (YYYY-MM-DD)
    const formatToISO = (dateStr) => {
      if (!dateStr) return null;
      // Tratar casos como "Domingo 1 (31/03/2026)" ou "Data: 31/03/2026"
      const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (match) return `${match[3]}-${match[2]}-${match[1]}`;
      return dateStr;
    };

    // Agrupar lançamentos
    const entries = [];
    const count = (config.type === 'all') ? config.sundays.length : 1;

    for (let i = 0; i < count; i++) {
        const dateLabel = (config.type === 'all') ? rawData[`date_${i}`] : selectedDateSelect.value;
        if (!dateLabel && config.type !== 'all') {
          Swal.fire('Aviso', 'Selecione a data do domingo.', 'warning');
          return;
        }

        entries.push({
          data_reuniao: formatToISO(dateLabel),
          meninas: parseInt(rawData[`meninas_${i}`] || 0),
          meninos: parseInt(rawData[`meninos_${i}`] || 0),
          colaboradoras: 0,
          livro: "-",
          capitulo: "-",
          versiculo: "-",
          titulo_historia: "-",
          instrutora: window.auxiliarFullName || user.user_metadata?.full_name || user.email.split('@')[0],
          localidade: config.comum,
          cidade: config.municipio
        });
    }


    Swal.fire({
      title: 'Enviando...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      // Enviar cada entrada Separadamente ou em Batch
      // Vou enviar em Batch se o backend suportar, mas o server.js atual espera um por um.
      // Vou ajustar o server.js para aceitar array ou iterar aqui.
      for (const entry of entries) {
        const res = await fetch('/api/recitativos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
        if (!res.ok) throw new Error('Falha no envio de uma das datas');
      }

      Swal.fire({
        title: 'Sucesso!',
        text: 'Lançamento realizado com sucesso.',
        icon: 'success',
        timer: 4000,
        timerProgressBar: true,
        showConfirmButton: true,
        confirmButtonText: 'OK',
        confirmButtonColor: '#1e4b7a'
      }).then(() => {
        window.location.href = '/';
      });
    } catch (err) {
      Swal.fire('Erro', err.message, 'error');
    }
  });
});
