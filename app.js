/* ScratchKE V2 — front-end demo. Never use client-side prize logic for real-money play. */
'use strict';

function $(id) {
  return document.getElementById(id);
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? Math.round(amount).toLocaleString('en-KE')
    : '0';
}

const SUPABASE_URL = 'https://ahatbnwqcozjzxehcnjc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NFltu0VR5bo6K097P6-gSw_XWxnPLVl';
const MPESA_API_BASE = 'https://scratchke-backend.netlify.app';
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

const cards = {
  Bronze: {
    cost: 20,
    max: 100,
    prizes: [0, 0, 10, 20, 30, 50, 100],
    tier: 'bronze',
    ticketStyle: 'ticket-red',
    icon: '🎁',
    description: 'A colourful digital scratch ticket.'
  },
  Silver: {
    cost: 50,
    max: 250,
    prizes: [0, 0, 20, 40, 50, 75, 100, 150, 250],
    tier: 'silver',
    ticketStyle: 'ticket-blue',
    icon: '⭐',
    description: 'A colourful digital scratch ticket.'
  },
  Gold: {
    cost: 100,
    max: 500,
    prizes: [0, 0, 25, 50, 75, 100, 150, 250, 500],
    tier: 'gold',
    ticketStyle: 'ticket-purple',
    icon: '🎉',
    description: 'A colourful digital scratch ticket.'
  }
};

let currentUser = null;
let profile = null;
let activeCardName = null;
let pendingPrize = 0;
let canvas = null;
let ctx = null;
let isDrawing = false;
let revealLocked = false;
let lastPoint = null;
let scratchedPoints = 0;
let authViewBeforeReset = 'login';
let isScratchKEAdmin = false;

function setMessage(id, message, isError = false) {
  const el = $(id);
  if (!el) return;

  el.textContent = message || '';
  el.classList.toggle('error', Boolean(isError));
}

function showAuth(view = 'login') {
  if (currentUser) return;

  $('auth')?.classList.remove('hidden');
  setAuthPanel(view);

  document.body.classList.add('dialog-open');

  const focusTarget =
    view === 'register'
      ? 'registerName'
      : view === 'forgot'
        ? 'forgotEmail'
        : 'loginEmail';

  window.setTimeout(() => $(focusTarget)?.focus(), 30);
}

function hideAuth() {
  $('auth')?.classList.add('hidden');
  document.body.classList.remove('dialog-open');
}

function setAuthPanel(view) {
  [
    'loginPanel',
    'registerPanel',
    'forgotPanel',
    'resetPasswordPanel'
  ].forEach(id => $(id)?.classList.add('hidden'));

  const panel = ({
    login: 'loginPanel',
    register: 'registerPanel',
    forgot: 'forgotPanel',
    reset: 'resetPasswordPanel'
  })[view] || 'loginPanel';

  $(panel)?.classList.remove('hidden');

  [
    'loginMessage',
    'registerMessage',
    'forgotMessage',
    'resetPasswordMessage'
  ].forEach(id => setMessage(id, ''));
}

function updateHeader() {
  const loggedIn = Boolean(currentUser);

  $('loginOpenBtn')?.classList.toggle('hidden', loggedIn);
  $('logout')?.classList.toggle('hidden', !loggedIn);
  $('userName')?.classList.toggle('hidden', !loggedIn);

  if ($('userName')) {
    $('userName').textContent =
      profile?.name || currentUser?.email || 'Account';
  }

  if ($('balance')) {
    $('balance').textContent = loggedIn
      ? `KSh ${money(profile?.balance)}`
      : '—';
  }

  if ($('walletHint')) {
    $('walletHint').textContent = loggedIn
      ? 'Virtual demo credits only.'
      : 'Log in to access your demo wallet.';
  }

  if ($('cardNotice')) {
    $('cardNotice').textContent = loggedIn
      ? 'Your plays and results are saved to your demo account.'
      : 'You can browse cards without an account. Log in or register to play.';
  }

  $('walletDropdown')?.classList.toggle('wallet-locked', !loggedIn);
  $('adminDashboardBtn')?.classList.toggle(
    'hidden',
    !loggedIn || !isScratchKEAdmin
  );
}

function renderCards() {
  const container = $('cards');
  if (!container) return;

  container.replaceChildren();

  Object.entries(cards).forEach(([name, card]) => {
    const article = document.createElement('article');
    article.className = `scratch-card ${card.ticketStyle}`;
    article.setAttribute(
      'aria-label',
      `Scratch ticket costing KSh ${money(card.cost)}`
    );

    const borderTop = document.createElement('div');
    borderTop.className = 'ticket-border ticket-border-top';
    borderTop.setAttribute('aria-hidden', 'true');
    borderTop.textContent = '✦  ✿  ★  ✿  ✦  ★  ✿  ✦';

    const top = document.createElement('div');
    top.className = 'ticket-topline';

    const brand = document.createElement('span');
    brand.className = 'ticket-brand';
    brand.textContent = 'SCRATCHKE';

    const icon = document.createElement('span');
    icon.className = 'ticket-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = card.icon;

    top.append(brand, icon);

    const middle = document.createElement('div');
    middle.className = 'ticket-main';

    const heading = document.createElement('h3');
    heading.innerHTML = 'SCRATCH <span>&amp;</span> WIN!';

    const promo = document.createElement('p');
    promo.className = 'ticket-promo';
    promo.textContent = 'Scratch to reveal your prize';

    const prizeLabel = document.createElement('div');
    prizeLabel.className = 'ticket-prize-label';
    prizeLabel.innerHTML =
      `<span>PRIZE RANGE</span><strong>KSh 0 – ${money(card.max)}</strong>`;

    middle.append(heading, promo, prizeLabel);

    const bottom = document.createElement('div');
    bottom.className = 'ticket-bottom';

    const cost = document.createElement('span');
    cost.className = 'ticket-price';
    cost.innerHTML = `PLAY FOR <strong>KSh ${money(card.cost)}</strong>`;

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'ticket-play-btn';
    play.textContent = 'Scratch now';

    play.addEventListener('click', () => {
      if (!currentUser) {
        showAuth('login');
        return;
      }

      openCard(name);
    });

    bottom.append(cost, play);

    const borderBottom = document.createElement('div');
    borderBottom.className = 'ticket-border ticket-border-bottom';
    borderBottom.setAttribute('aria-hidden', 'true');
    borderBottom.textContent = '✦  ✿  ★  ✿  ✦  ★  ✿  ✦';

    article.append(borderTop, top, middle, bottom, borderBottom);
    container.append(article);
  });
}

async function getProfile() {
  if (!supabaseClient || !currentUser) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) {
    console.error('Profile fetch failed:', error);
    return null;
  }

  profile = data || null;
  return profile;
}

async function getPrizePool() {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from('prize_pool')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('Prize pool fetch failed:', error);
    return null;
  }

  if ($('availablePool')) {
    $('availablePool').textContent =
      `KSh ${money(data?.available_pool || 0)}`;
  }

  return data;
}

function selectAffordablePrize(card, availablePool) {
  const affordable = card.prizes.filter(
    prize =>
      Number(prize) <= Math.max(0, Number(availablePool) || 0)
  );

  if (!affordable.length) return 0;

  return Number(
    affordable[Math.floor(Math.random() * affordable.length)] || 0
  );
}

async function ensureProfileForUser(user, name = '') {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: inserted, error: insertError } = await supabaseClient
    .from('profiles')
    .insert({
      id: user.id,
      name:
        name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Player',
      balance: 500,
      played: 0,
      won: 0,
      best: 0
    })
    .select('*')
    .single();

  if (insertError) throw insertError;

  return inserted;
}

async function enterAccount(user, name = '') {
  currentUser = user;

  try {
    profile = await ensureProfileForUser(user, name);
  } catch (error) {
    console.error('Profile setup failed:', error);

    setMessage(
      'loginMessage',
      `Your account is authenticated, but the profile could not be loaded: ${error.message}`,
      true
    );

    currentUser = user;
    profile = null;
  }

  hideAuth();
  updateHeader();

  await refreshScratchKEAdmin();
  updateHeader();

  await renderAccountData();
}

async function renderAccountData() {
  if (!currentUser) {
    profile = null;
    updateHeader();
    return;
  }

  if (!profile) await getProfile();

  updateHeader();

  if (profile) {
    if ($('played')) {
      $('played').textContent = money(profile.played);
    }

    if ($('won')) {
      $('won').textContent = `KSh ${money(profile.won)}`;
    }

    if ($('best')) {
      $('best').textContent = `KSh ${money(profile.best)}`;
    }
  }

  await getPrizePool();
  await loadHistory();
}

/* =========================
   LOGIN AND REGISTRATION
   ========================= */

$('loginOpenBtn')?.addEventListener('click', () => showAuth('login'));
$('authCloseBtn')?.addEventListener('click', hideAuth);

$('auth')?.addEventListener('click', event => {
  if (event.target === $('auth')) hideAuth();
});

$('showRegister')?.addEventListener(
  'click',
  () => setAuthPanel('register')
);

$('showLogin')?.addEventListener(
  'click',
  () => setAuthPanel('login')
);

$('forgotPasswordBtn')?.addEventListener('click', () => {
  authViewBeforeReset = 'login';
  setAuthPanel('forgot');
});

$('forgotBackBtn')?.addEventListener(
  'click',
  () => setAuthPanel(authViewBeforeReset)
);

$('loginForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  if (!supabaseClient) {
    setMessage(
      'loginMessage',
      'Supabase could not load. Check your internet connection and try again.',
      true
    );
    return;
  }

  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;

  setMessage('loginMessage', 'Signing in…');

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setMessage('loginMessage', error.message, true);
    return;
  }

  await enterAccount(data.user);
});

$('registerForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  if (!supabaseClient) {
    setMessage(
      'registerMessage',
      'Supabase could not load. Check your internet connection and try again.',
      true
    );
    return;
  }

  const name = $('registerName').value.trim();
  const email = $('registerEmail').value.trim();
  const password = $('registerPassword').value;
  const confirm = $('registerConfirm').value;

  if (password !== confirm) {
    setMessage('registerMessage', 'Passwords do not match.', true);
    return;
  }

  if (password.length < 6) {
    setMessage(
      'registerMessage',
      'Password must be at least 6 characters.',
      true
    );
    return;
  }

  setMessage('registerMessage', 'Creating your account…');

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { name } }
  });

  if (error) {
    setMessage('registerMessage', error.message, true);
    return;
  }

  if (data?.session && data?.user) {
    try {
      await ensureProfileForUser(data.user, name);
      await enterAccount(data.user, name);
    } catch (profileError) {
      setMessage(
        'registerMessage',
        `Account created but profile setup failed: ${profileError.message}`,
        true
      );
    }
  } else {
    setMessage(
      'registerMessage',
      'Registration started. Check your email to confirm the account, then log in. If profile creation is not automatic in your database, use the SQL setup notes provided with these files.'
    );
  }
});

$('forgotForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  if (!supabaseClient) {
    setMessage(
      'forgotMessage',
      'Supabase could not load. Check your internet connection and try again.',
      true
    );
    return;
  }

  const email = $('forgotEmail').value.trim();

  const { error } = await supabaseClient.auth.resetPasswordForEmail(
    email,
    { redirectTo: window.location.origin }
  );

  setMessage(
    'forgotMessage',
    error
      ? error.message
      : 'If that email is registered, a password reset link has been sent.',
    Boolean(error)
  );
});

$('resetPasswordForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  if (!supabaseClient) {
    setMessage(
      'resetPasswordMessage',
      'Supabase could not load. Check your internet connection and try again.',
      true
    );
    return;
  }

  const password = $('newPassword').value;
  const confirm = $('confirmNewPassword').value;

  if (password.length < 6 || password !== confirm) {
    setMessage(
      'resetPasswordMessage',
      password !== confirm
        ? 'Passwords do not match.'
        : 'Password must be at least 6 characters.',
      true
    );
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({ password });

  setMessage(
    'resetPasswordMessage',
    error
      ? error.message
      : 'Password updated. You can now log in.',
    Boolean(error)
  );

  if (!error) {
    window.setTimeout(() => {
      hideAuth();
      setAuthPanel('login');
    }, 1000);
  }
});

$('logout')?.addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert(`Logout failed: ${error.message}`);
    return;
  }

  currentUser = null;
  profile = null;
  isScratchKEAdmin = false;
  pendingPrize = 0;
  activeCardName = null;
  revealLocked = false;

  $('adminDashboard')?.classList.add('hidden');
  document.body.classList.remove('admin-mode');

  updateHeader();

  if ($('played')) $('played').textContent = '0';
  if ($('won')) $('won').textContent = 'KSh 0';
  if ($('best')) $('best').textContent = 'KSh 0';

  if ($('history')) {
    $('history').innerHTML =
      '<p class="empty-state">Log in to view your play history.</p>';
  }

  if ($('availablePool')) await getPrizePool();
});

/* =========================
   SCRATCH CARD GAME
   ========================= */

async function openCard(cardName) {
  if (!currentUser) {
    showAuth('login');
    return;
  }

  const card = cards[cardName];
  if (!card) return;

  await getProfile();

  if (!profile) {
    alert('Your profile could not be loaded. Please log out and log in again.');
    return;
  }

  if (Number(profile.balance || 0) < card.cost) {
    alert('Insufficient demo credits. Use the demo wallet to add virtual credits.');
    return;
  }

  const newBalance = Number(profile.balance || 0) - card.cost;
  const newPlayed = Number(profile.played || 0) + 1;

  const { error } = await supabaseClient
    .from('profiles')
    .update({
      balance: newBalance,
      played: newPlayed
    })
    .eq('id', currentUser.id);

  if (error) {
    console.error('Ticket charge failed:', error);
    alert('Unable to start the card. Please try again.');
    return;
  }

  profile.balance = newBalance;
  profile.played = newPlayed;

  activeCardName = cardName;
  pendingPrize = 0;
  revealLocked = false;
  isDrawing = false;
  lastPoint = null;
  scratchedPoints = 0;

  const pool = await getPrizePool();

  pendingPrize = selectAffordablePrize(
    card,
    Number(pool?.available_pool || 0)
  );

  $('title').textContent =
    `ScratchKE ticket — KSh ${money(card.cost)}`;

  $('sub').textContent =
    `Play price: KSh ${money(card.cost)} · Prize range: KSh 0–${money(card.max)}`;

  const surface = $('scratchSurface');

  if (surface) {
    const palette =
      card.ticketStyle === 'ticket-red'
        ? ['#ff667b', '#b8002f']
        : card.ticketStyle === 'ticket-blue'
          ? ['#8df5ff', '#00a8d6']
          : ['#e7b8ff', '#7542d7'];

    surface.style.background =
      `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`;
  }

  $('prize').innerHTML =
    `<small>DEMO PRIZE</small>KSh ${money(pendingPrize)}`;

  $('result').textContent =
    'Scratch the card to reveal your demo prize.';

  $('again').disabled = true;

  $('modal')?.classList.remove('hidden');
  document.body.classList.add('dialog-open');

  setupCanvas();
  await renderAccountData();
}

function setupCanvas() {
  canvas = $('canvas');
  if (!canvas) return;

  ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    $('result').textContent =
      'Your browser could not load the scratch surface.';
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = rect.width;
  const h = rect.height;

  const gradient = ctx.createLinearGradient(0, 0, w, h);

  const coat =
    activeCardName === 'Bronze'
      ? ['#ffb0b9', '#d10d39', '#ffedf0']
      : activeCardName === 'Silver'
        ? ['#b8faff', '#087fa9', '#e7fdff']
        : ['#edcaff', '#7542d7', '#f6eaff'];

  gradient.addColorStop(0, coat[0]);
  gradient.addColorStop(.28, coat[1]);
  gradient.addColorStop(.52, coat[2]);
  gradient.addColorStop(.78, coat[1]);
  gradient.addColorStop(1, coat[0]);

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.save();

  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle = i % 2
      ? 'rgba(255,255,255,.12)'
      : 'rgba(20,40,28,.09)';

    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w * .2, i * h / 12);
    ctx.lineTo(w * 1.2, i * h / 12 - 35);
    ctx.stroke();
  }

  ctx.restore();

  ctx.fillStyle = '#24392d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '1000 20px system-ui, sans-serif';
  ctx.fillText('SCRATCH & WIN!', w / 2, h / 2 - 5);

  ctx.font = '700 10px system-ui, sans-serif';
  ctx.fillText('RUB TO REVEAL YOUR PRIZE', w / 2, h / 2 + 19);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function eraseAt(point) {
  if (!ctx || !point || revealLocked) return;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 42;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (lastPoint) {
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(point.x, point.y, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  lastPoint = point;
  scratchedPoints++;

  if (scratchedPoints % 5 === 0 && scratchedEnough()) {
    revealCard();
  }
}

function scratchedEnough() {
  try {
    const image = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    ).data;

    let transparent = 0;
    const step = 24;

    for (let i = 3; i < image.length; i += 4 * step) {
      if (image[i] < 80) transparent++;
    }

    return transparent / Math.ceil(image.length / (4 * step)) > .32;
  } catch (_) {
    return scratchedPoints > 35;
  }
}

canvas = $('canvas');

canvas?.addEventListener('pointerdown', event => {
  if (
    revealLocked ||
    $('modal')?.classList.contains('hidden')
  ) return;

  event.preventDefault();
  isDrawing = true;
  lastPoint = canvasPoint(event);
  canvas.setPointerCapture?.(event.pointerId);
  eraseAt(lastPoint);
});

canvas?.addEventListener('pointermove', event => {
  if (!isDrawing || revealLocked) return;

  event.preventDefault();
  eraseAt(canvasPoint(event));
});

[
  'pointerup',
  'pointercancel',
  'lostpointercapture'
].forEach(type => {
  canvas?.addEventListener(type, () => {
    isDrawing = false;
    lastPoint = null;
  });
});

async function recordPlay(cardName, prize) {
  if (!currentUser) return;

  const { error } = await supabaseClient
    .from('plays')
    .insert({
      user_id: currentUser.id,
      card: cardName,
      prize: Number(prize || 0)
    });

  if (error) {
    console.error('Could not save play history:', error);
  }
}

async function revealCard() {
  if (revealLocked || !activeCardName || !currentUser) return;

  revealLocked = true;
  isDrawing = false;
  lastPoint = null;

  if (pendingPrize <= 0) {
    await recordPlay(activeCardName, 0);

    $('result').textContent =
      'No prize this time. Your ticket has been recorded.';

    $('again').disabled = false;
    await renderAccountData();
    return;
  }

  // The database function must deduct the pool, credit the wallet,
  // update statistics and record the play transactionally.
  let award = await supabaseClient.rpc('award_prize', {
    p_prize_amount: Number(pendingPrize),
    p_card_name: activeCardName
  });

  if (award.error || award.data !== true) {
    console.warn(
      'Prize award failed; refreshing the shared pool.',
      award.error
    );

    const pool = await getPrizePool();

    const alternative = selectAffordablePrize(
      cards[activeCardName],
      Number(pool?.available_pool || 0)
    );

    if (alternative > 0) {
      pendingPrize = alternative;

      award = await supabaseClient.rpc('award_prize', {
        p_prize_amount: Number(pendingPrize),
        p_card_name: activeCardName
      });
    }
  }

  if (award.error || award.data !== true) {
    console.error('Could not award demo prize:', award.error);

    pendingPrize = 0;

    await recordPlay(activeCardName, 0);

    $('result').textContent =
      'The prize pool changed before the prize could be awarded. No prize was paid.';

    $('again').disabled = false;
    await renderAccountData();
    return;
  }

  await getProfile();

  $('result').textContent =
    `🎉 You revealed KSh ${money(pendingPrize)} in demo credits!`;

  $('prize').classList.add('prize-celebrate');
  $('again').disabled = false;

  await renderAccountData();
}

function closeScratchModal() {
  $('modal')?.classList.add('hidden');
  document.body.classList.remove('dialog-open');

  activeCardName = null;
  pendingPrize = 0;
  revealLocked = false;
  isDrawing = false;
  lastPoint = null;
  scratchedPoints = 0;

  $('prize')?.classList.remove('prize-celebrate');
}

$('close')?.addEventListener('click', closeScratchModal);

$('modal')?.addEventListener('click', event => {
  if (
    event.target === $('modal') &&
    revealLocked
  ) {
    closeScratchModal();
  }
});

$('again')?.addEventListener('click', async () => {
  closeScratchModal();
  await renderAccountData();
});

/* =========================
   DEMO WALLET
   ========================= */

$('depositBtn')?.addEventListener('click', async () => {
  if (!currentUser) {
    showAuth('login');
    return;
  }

  const amount = Number($('depositAmount')?.value);
  const phone = $('depositPhone')?.value.trim();

  if (
    !Number.isInteger(amount) ||
    amount < 10 ||
    amount > 1000000
  ) {
    setMessage(
      'walletMessage',
      'Enter a whole amount between KSh 10 and KSh 1,000,000.',
      true
    );
    return;
  }

  if (!phone) {
    setMessage(
      'walletMessage',
      'Enter your M-Pesa phone number.',
      true
    );
    return;
  }

  try {
    const {
      data: sessionData,
      error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    const token = sessionData?.session?.access_token;

    if (!token) {
      throw new Error(
        'Your session has expired. Please log in again.'
      );
    }

    const response = await fetch(
      `${MPESA_API_BASE}/api/deposit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount, phone })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || 'Could not start the M-Pesa payment.'
      );
    }

    setMessage(
      'walletMessage',
      result.message ||
        'Sandbox payment request submitted. Check your payment status before trying again.'
    );
  } catch (error) {
    console.error('M-Pesa deposit error:', error);

    setMessage(
      'walletMessage',
      `Could not start M-Pesa payment: ${error.message}`,
      true
    );
  }
});

$('withdrawBtn')?.addEventListener('click', async () => {
  if (!currentUser) {
    showAuth('login');
    return;
  }

  const amount = Number($('withdrawAmount')?.value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000
  ) {
    setMessage(
      'walletMessage',
      'Enter a valid amount between KSh 0.01 and KSh 1,000,000.',
      true
    );
    return;
  }

  try {
    const { data, error } = await supabaseClient.rpc(
      'remove_demo_credits',
      { p_amount: amount }
    );

    if (error) throw error;

    if (data !== true) {
      setMessage(
        'walletMessage',
        'Insufficient demo credits.',
        true
      );
      return;
    }

    $('withdrawAmount').value = '';

    setMessage(
      'walletMessage',
      `Removed KSh ${money(amount)} in demo credits. No real withdrawal was made.`
    );

    await getProfile();
    await renderAccountData();
  } catch (error) {
    console.error('Demo credit removal error:', error);

    setMessage(
      'walletMessage',
      `Could not remove demo credits: ${error.message}`,
      true
    );
  }
});

$('reset')?.addEventListener('click', async () => {
  if (!currentUser) {
    showAuth('login');
    return;
  }

  if (!window.confirm(
    'Reset your demo balance and statistics to the starting values? This will not reset the shared prize pool.'
  )) return;

  const { error } = await supabaseClient
    .from('profiles')
    .update({
      balance: 500,
      played: 0,
      won: 0,
      best: 0
    })
    .eq('id', currentUser.id);

  if (error) {
    alert(`Could not reset demo account: ${error.message}`);
    return;
  }

  await getProfile();
  await renderAccountData();

  setMessage(
    'walletMessage',
    'Demo account reset to KSh 500.'
  );
});

/* =========================
   PLAY HISTORY
   ========================= */

async function loadHistory() {
  const history = $('history');
  if (!history) return;

  if (!currentUser) {
    history.innerHTML =
      '<p class="empty-state">Log in to view your play history.</p>';
    return;
  }

  const { data, error } = await supabaseClient
    .from('plays')
    .select('card,prize,created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('Play history failed:', error);

    history.innerHTML =
      '<p class="empty-state">Play history could not be loaded.</p>';

    return;
  }

  history.replaceChildren();

  if (!data?.length) {
    history.innerHTML =
      '<p class="empty-state">No plays yet. Choose a card above to get started.</p>';
    return;
  }

  data.forEach(play => {
    const row = document.createElement('div');
    row.className = 'history-row';

    const main = document.createElement('div');
    main.className = 'history-main';

    const title = document.createElement('strong');
    title.textContent = `${play.card || 'Scratch'} card`;

    const time = document.createElement('small');
    time.textContent = play.created_at
      ? new Date(play.created_at).toLocaleString()
      : 'Recent play';

    const prize = document.createElement('span');
    prize.className = 'history-prize';
    prize.textContent = `KSh ${money(play.prize)}`;

    main.append(title, time);
    row.append(main, prize);
    history.append(row);
  });
}

/* =========================
   PRIVATE ADMIN DASHBOARD
   ========================= */

async function refreshScratchKEAdmin() {
  isScratchKEAdmin = false;

  if (!currentUser || !supabaseClient) return false;

  try {
    const { data, error } = await supabaseClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error) {
      console.warn('Admin access check failed:', error.message);
      return false;
    }

    isScratchKEAdmin = Boolean(data?.user_id);
  } catch (error) {
    console.warn('Admin access check failed:', error);
  }

  return isScratchKEAdmin;
}

async function requireScratchKEAdmin() {
  if (!currentUser || !await refreshScratchKEAdmin()) {
    alert('Administrator access is required for this area.');
    return false;
  }

  return true;
}

function adminCell(row, value) {
  const cell = document.createElement('td');

  cell.textContent =
    value === null || value === undefined || value === ''
      ? '—'
      : String(value);

  row.appendChild(cell);
}

function adminDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString();
}

function adminEmptyRow(bodyId, colspan, message) {
  const body = $(bodyId);
  if (!body) return;

  const row = document.createElement('tr');
  const cell = document.createElement('td');

  cell.colSpan = colspan;
  cell.textContent = message;

  row.appendChild(cell);
  body.replaceChildren(row);
}

function adminFillRows(bodyId, rows, columns, emptyMessage) {
  const body = $(bodyId);
  if (!body) return;

  body.replaceChildren();

  if (!rows?.length) {
    adminEmptyRow(
      bodyId,
      columns.length,
      emptyMessage
    );
    return;
  }

  rows.forEach(item => {
    const row = document.createElement('tr');

    columns.forEach(column => {
      adminCell(row, column(item));
    });

    body.appendChild(row);
  });
}

async function loadAdminDashboard() {
  if (!await requireScratchKEAdmin()) return;

  const message = $('fundingFormMessage');

  if (message) {
    message.textContent = 'Loading dashboard data…';
  }

  const [
    profilesResult,
    playsResult,
    transactionsResult,
    fundingResult
  ] = await Promise.all([
    supabaseClient
      .from('profiles')
      .select('id,name,balance,played,won,created_at')
      .order('created_at', { ascending: false })
      .limit(500),

    supabaseClient
      .from('plays')
      .select('id,user_id,card,prize,created_at')
      .order('created_at', { ascending: false })
      .limit(500),

    supabaseClient
      .from('transactions')
      .select('id,user_id,type,amount,status,reference,created_at')
      .order('created_at', { ascending: false })
      .limit(500),

    supabaseClient
      .from('funding_records')
      .select('id,user_email,mpesa_phone,amount,mpesa_reference,status,created_at')
      .order('created_at', { ascending: false })
      .limit(500)
  ]);

  const failure = [
    profilesResult,
    playsResult,
    transactionsResult,
    fundingResult
  ].find(result => result.error);

  if (failure) {
    console.error(
      'Admin dashboard data load failed:',
      failure.error
    );

    if (message) {
      message.textContent =
        `Could not load dashboard data: ${failure.error.message}. Confirm that admin_dashboard_setup.sql has been run.`;
    }

    return;
  }

  const profiles = profilesResult.data || [];
  const plays = playsResult.data || [];
  const transactions = transactionsResult.data || [];
  const funding = fundingResult.data || [];

  $('adminUserCount').textContent = money(profiles.length);
  $('adminPlayCount').textContent = money(plays.length);
  $('adminFundingCount').textContent = money(funding.length);

  adminFillRows(
    'adminUserRows',
    profiles,
    [
      p => p.name,
      p => p.id,
      p => `KSh ${money(p.balance)}`,
      p => money(p.played),
      p => `KSh ${money(p.won)}`,
      p => adminDate(p.created_at)
    ],
    'No registered profiles found.'
  );

  adminFillRows(
    'adminPlayRows',
    plays,
    [
      p => adminDate(p.created_at),
      p => p.user_id,
      p => p.card,
      p => `KSh ${money(p.prize)}`
    ],
    'No play records found.'
  );

  adminFillRows(
    'adminTransactionRows',
    transactions,
    [
      t => adminDate(t.created_at),
      t => t.user_id,
      t => t.type,
      t => `KSh ${money(t.amount)}`,
      t => t.status,
      t => t.reference
    ],
    'No wallet transaction records found.'
  );

  renderAdminFundingRows(funding);

  if (message) {
    message.textContent =
      'Dashboard refreshed. Funding records do not change wallet balances.';
  }
}

function renderAdminFundingRows(records) {
  const body = $('adminFundingRows');
  if (!body) return;

  body.replaceChildren();

  if (!records.length) {
    adminEmptyRow(
      'adminFundingRows',
      7,
      'No funding records yet.'
    );
    return;
  }

  records.forEach(record => {
    const row = document.createElement('tr');

    adminCell(row, adminDate(record.created_at));
    adminCell(row, record.user_email);
    adminCell(row, record.mpesa_phone);
    adminCell(row, `KSh ${money(record.amount)}`);
    adminCell(row, record.mpesa_reference);
    adminCell(row, record.status);

    const actionCell = document.createElement('td');
    const select = document.createElement('select');

    ['pending', 'verified', 'rejected'].forEach(status => {
      const option = document.createElement('option');

      option.value = status;
      option.textContent = status;
      option.selected = status === record.status;

      select.appendChild(option);
    });

    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save status';
    save.className = 'small-admin-button';

    save.addEventListener('click', async () => {
      if (!await requireScratchKEAdmin()) return;

      const { error } = await supabaseClient
        .from('funding_records')
        .update({ status: select.value })
        .eq('id', record.id);

      if (error) {
        alert(`Could not update funding record: ${error.message}`);
        return;
      }

      await loadAdminDashboard();
    });

    actionCell.append(select, save);
    row.appendChild(actionCell);
    body.appendChild(row);
  });
}

async function openAdminScreen() {
  if (!await requireScratchKEAdmin()) return;

  document.body.classList.add('admin-mode');
  $('adminDashboard')?.classList.remove('hidden');

  if ($('adminPageSelect')) {
    $('adminPageSelect').value = 'overview';
  }

  document.querySelectorAll('[data-admin-view]').forEach(view => {
    view.classList.toggle(
      'active',
      view.getAttribute('data-admin-view') === 'overview'
    );
  });

  window.scrollTo({ top: 0, behavior: 'auto' });

  await loadAdminDashboard();
}

function closeAdminScreen() {
  document.body.classList.remove('admin-mode');
  $('adminDashboard')?.classList.add('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('adminDashboardBtn')?.addEventListener(
  'click',
  openAdminScreen
);

$('closeAdminDashboard')?.addEventListener(
  'click',
  closeAdminScreen
);

$('brandHome')?.addEventListener('click', event => {
  if (document.body.classList.contains('admin-mode')) {
    event.preventDefault();
    closeAdminScreen();
  }
});

$('adminRefreshBtn')?.addEventListener(
  'click',
  loadAdminDashboard
);

$('adminPageSelect')?.addEventListener('change', event => {
  const page = event.target.value;

  document.querySelectorAll('[data-admin-view]').forEach(view => {
    view.classList.toggle(
      'active',
      view.getAttribute('data-admin-view') === page
    );
  });
});

$('fundingRecordForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  if (!await requireScratchKEAdmin()) return;

  const message = $('fundingFormMessage');
  const amount = Number($('fundingAmount').value);
  const reference = $('fundingReference').value.trim().toUpperCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    message.textContent = 'Enter a valid positive amount.';
    return;
  }

  if (!reference) {
    message.textContent = 'Enter the M-Pesa receipt/reference.';
    return;
  }

  message.textContent = 'Saving funding record…';

  const record = {
    user_email: $('fundingEmail').value.trim().toLowerCase(),
    mpesa_phone: $('fundingPhone').value.trim() || null,
    amount,
    mpesa_reference: reference,
    status: $('fundingStatus').value,
    notes: $('fundingNotes').value.trim() || null,
    created_by: currentUser.id
  };

  const { error } = await supabaseClient
    .from('funding_records')
    .insert(record);

  if (error) {
    message.textContent = `Could not save record: ${error.message}`;
    return;
  }

  $('fundingRecordForm').reset();

  message.textContent =
    'Receipt record saved. No wallet balance was changed.';

  await loadAdminDashboard();
});

/* =========================
   APPLICATION STARTUP
   ========================= */

async function start() {
  renderCards();

  if (!supabaseClient) {
    $('cardNotice').textContent =
      'Cards are visible in preview mode, but account features are unavailable because the Supabase client did not load.';

    updateHeader();
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error('Session check failed:', error);
    }

    if (data?.session?.user) {
      await enterAccount(data.session.user);
    } else {
      updateHeader();
      await getPrizePool();
    }
  } catch (error) {
    console.error('Application startup failed:', error);
    updateHeader();
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showAuth('reset');
      return;
    }

    if (event === 'SIGNED_OUT') {
      currentUser = null;
      profile = null;
      isScratchKEAdmin = false;

      $('adminDashboard')?.classList.add('hidden');
      document.body.classList.remove('admin-mode');

      updateHeader();
    }
  });
}

start();
