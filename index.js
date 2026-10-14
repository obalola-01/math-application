import { Purchases } from '@revenuecat/purchases-js';
import { createClient } from '@supabase/supabase-js'

const anonymousAppUserIdStorageKey = 'math-tutor-revenuecat-anonymous-user-id';
function getAnonymousAppUserId() {
  try {
    const storedAppUserId = localStorage.getItem(anonymousAppUserIdStorageKey);
    if (storedAppUserId) return storedAppUserId;

    const generatedAppUserId = Purchases.generateRevenueCatAnonymousAppUserId();
    localStorage.setItem(anonymousAppUserIdStorageKey, generatedAppUserId);
    return generatedAppUserId;
  } catch {
    return Purchases.generateRevenueCatAnonymousAppUserId();
  }
}

const appUserId = getAnonymousAppUserId();
const revenueCatApiKey = import.meta.env.VITE_REVENUECAT_API_KEY;
let purchases = revenueCatApiKey ? Purchases.configure({
    apiKey: revenueCatApiKey,
    appUserId
}) : null;
let purchasesUserId = appUserId;

const debugBox = document.getElementById('debug-box');
const subscribeBtn = document.getElementById('subscribe-btn');
const manageSubscriptionLink = document.getElementById('manage-subscription');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authStatus = document.getElementById('auth-status');
const guardianConfirmation = document.getElementById('guardian-confirmation');
const signUpBtn = document.getElementById('sign-up-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const accountSession = document.getElementById('account-session');
const accountEmail = document.getElementById('account-email');
const topicSelect = document.getElementById('topic-select');
const answerForm = document.getElementById('answer-form');
const answerInput = document.getElementById('answer-input');
const problemBox = document.getElementById('problem');
const modelStatus = document.getElementById('model-status');
const solutionToggle = document.getElementById('solution-toggle');
const solutionPanel = document.getElementById('solution-panel');
const solutionSteps = document.getElementById('solution-steps');
const solutionAnswer = document.getElementById('solution-answer');

const storageKey = 'math-tutor-model-v1';
const topicNames = ['algebra', 'geometry', 'calculus'];
const startingModel = { weights: [0.8, -1.2, 0, 0, 0], attempts: [] };
let learnerModel = loadModel();
let currentProblem;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublicKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabasePublicKey
  ? createClient(supabaseUrl, supabasePublicKey)
  : null;

function loadModel() {
  try {
    const savedModel = JSON.parse(localStorage.getItem(storageKey));
    if (savedModel?.weights?.length === 5 && Array.isArray(savedModel.attempts)) {
      return savedModel;
    }
  } catch (error) {
    console.warn('Could not load saved learner progress:', error);
  }
  return structuredClone(startingModel);
}

function featuresFor(topic, difficulty) {
  return [1, (difficulty - 1) / 2, ...topicNames.map((name) => Number(name === topic))];
}

function predictCorrectness(topic, difficulty) {
  const score = featuresFor(topic, difficulty)
    .reduce((total, feature, index) => total + feature * learnerModel.weights[index], 0);
  return 1 / (1 + Math.exp(-score));
}

function trainModel() {
  for (let pass = 0; pass < 20; pass += 1) {
    const gradients = learnerModel.weights.map(() => 0);
    for (const attempt of learnerModel.attempts) {
      const features = featuresFor(attempt.topic, attempt.difficulty);
      const prediction = predictCorrectness(attempt.topic, attempt.difficulty);
      features.forEach((feature, index) => {
        gradients[index] += (attempt.correct - prediction) * feature;
      });
    }
    const rate = 0.025 / Math.max(1, learnerModel.attempts.length);
    learnerModel.weights = learnerModel.weights.map((weight, index) => weight + rate * gradients[index]);
  }
  localStorage.setItem(storageKey, JSON.stringify(learnerModel));
}

function recommendedDifficulty(topic) {
  return [1, 2, 3].reduce((best, difficulty) => {
    const targetDistance = Math.abs(predictCorrectness(topic, difficulty) - 0.7);
    return targetDistance < best.distance ? { difficulty, distance: targetDistance } : best;
  }, { difficulty: 1, distance: Infinity }).difficulty;
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeProblem(topic, difficulty) {
  if (topic === 'algebra') {
    const answer = randomInteger(2, 9);
    if (difficulty === 1) {
      const offset = randomInteger(2, 12);
      const total = answer + offset;
      return {
        text: `Solve for x: x + ${offset} = ${total}`,
        answer,
        steps: [
          `Subtract ${offset} from both sides to isolate x.`,
          `x = ${total} - ${offset} = ${answer}.`
        ]
      };
    }
    const factor = randomInteger(2, 5);
    const offset = randomInteger(1, 9);
    const rightSide = difficulty === 2
      ? factor * answer + offset
      : factor * (answer - offset);
    const expression = difficulty === 2
      ? `${factor}x + ${offset} = ${rightSide}`
      : `${factor}(x - ${offset}) = ${rightSide}`;
    const steps = difficulty === 2
      ? [
        `Subtract ${offset} from both sides: ${factor}x = ${rightSide - offset}.`,
        `Divide both sides by ${factor}: x = ${rightSide - offset} / ${factor} = ${answer}.`
      ]
      : [
        `Divide both sides by ${factor}: x - ${offset} = ${rightSide / factor}.`,
        `Add ${offset} to both sides: x = ${rightSide / factor} + ${offset} = ${answer}.`
      ];
    return { text: `Solve for x: ${expression}`, answer, steps };
  }

  if (topic === 'geometry') {
    if (difficulty === 1) {
      const length = randomInteger(3, 12);
      const width = randomInteger(2, 9);
      const answer = length * width;
      return {
        text: `Find the area of a ${length} by ${width} rectangle.`,
        answer,
        steps: [
          'Use the rectangle area formula: area = length x width.',
          `Substitute the side lengths: area = ${length} x ${width} = ${answer}.`
        ]
      };
    }
    if (difficulty === 2) {
      const base = randomInteger(4, 12) * 2;
      const height = randomInteger(3, 10);
      const answer = base * height / 2;
      return {
        text: `Find the area of a triangle with base ${base} and height ${height}.`,
        answer,
        steps: [
          'Use the triangle area formula: area = (base x height) / 2.',
          `Substitute the measurements: area = (${base} x ${height}) / 2 = ${answer}.`
        ]
      };
    }
    const length = randomInteger(3, 9);
    const width = randomInteger(2, 8);
    const height = randomInteger(2, 7);
    const answer = length * width * height;
    return {
      text: `Find the volume of a ${length} by ${width} by ${height} rectangular prism.`,
      answer,
      steps: [
        'Use the rectangular prism volume formula: volume = length x width x height.',
        `Substitute the dimensions: volume = ${length} x ${width} x ${height} = ${answer}.`
      ]
    };
  }

  const coefficient = randomInteger(2, 5);
  const x = randomInteger(2, 6);
  const power = difficulty + 1;
  const derivative = coefficient * power * x ** (power - 1);
  return {
    text: `If f(x) = ${coefficient}x^${power}, what is f'(${x})?`,
    answer: derivative,
    steps: [
      `Apply the power rule: the derivative of ${coefficient}x^${power} is ${coefficient} x ${power} x^${power - 1}.`,
      `Simplify: f'(x) = ${coefficient * power}x^${power - 1}.`,
      `Substitute x = ${x}: f'(${x}) = ${coefficient * power} x ${x}^${power - 1} = ${derivative}.`
    ]
  };
}

function renderProblem(message = '') {
  const topic = topicSelect.value;
  const difficulty = recommendedDifficulty(topic);
  currentProblem = { ...makeProblem(topic, difficulty), topic, difficulty };
  problemBox.textContent = currentProblem.text;
  solutionToggle.setAttribute('aria-expanded', 'false');
  solutionToggle.textContent = 'Show step-by-step solution';
  solutionPanel.hidden = true;
  solutionSteps.replaceChildren(...currentProblem.steps.map((step) => {
    const item = document.createElement('li');
    item.textContent = step;
    return item;
  }));
  solutionAnswer.textContent = `Answer: ${currentProblem.answer}`;
  const probability = Math.round(predictCorrectness(topic, difficulty) * 100);
  const attempts = learnerModel.attempts.length;
  modelStatus.textContent = `${message}${attempts} answers learned. Suggested level: ${difficulty} of 3, with ${probability}% predicted chance of success.`;
}

solutionToggle.addEventListener('click', () => {
  const isOpen = solutionToggle.getAttribute('aria-expanded') === 'true';
  solutionToggle.setAttribute('aria-expanded', String(!isOpen));
  solutionToggle.textContent = isOpen ? 'Show step-by-step solution' : 'Hide step-by-step solution';
  solutionPanel.hidden = isOpen;
});

answerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const submittedAnswer = Number(answerInput.value);
  const correct = Math.abs(submittedAnswer - currentProblem.answer) < 1e-8;
  learnerModel.attempts.push({
    topic: currentProblem.topic,
    difficulty: currentProblem.difficulty,
    correct: Number(correct)
  });
  trainModel();
  answerInput.value = '';
  renderProblem(correct ? 'Correct. ' : `Not quite; the answer was ${currentProblem.answer}. `);
});

topicSelect.addEventListener('change', () => renderProblem());
renderProblem();

function setRevenueCatConfigRequiredState() {
  subscribeBtn.disabled = false;
  subscribeBtn.style.display = 'inline-block';
  manageSubscriptionLink.hidden = true;
  manageSubscriptionLink.removeAttribute('href');
  debugBox.innerHTML = 'RevenueCat is not configured yet. Add a valid VITE_REVENUECAT_API_KEY and create a current offering in the RevenueCat dashboard.';
  debugBox.style.color = 'orange';
}

function setSignedOutState() {
  authForm.hidden = false;
  accountSession.hidden = true;
  subscribeBtn.disabled = false;
  subscribeBtn.style.display = 'inline-block';

  if (revenueCatApiKey) {
    debugBox.textContent = 'Unlock premium tutoring for this app without signing in.';
  } else {
    setRevenueCatConfigRequiredState();
  }

  manageSubscriptionLink.hidden = true;
  manageSubscriptionLink.removeAttribute('href');
}

async function syncAuthSession(session) {
  const user = session?.user;
  if (!user) {
    setSignedOutState();
    authStatus.textContent = 'You can unlock premium tutoring without signing in.';
    return;
  }

  authForm.hidden = true;
  accountSession.hidden = false;
  accountEmail.textContent = user.email || 'Signed in';
  authStatus.textContent = `Signed in as ${user.email || 'your account'}.`;
  subscribeBtn.disabled = true;

  if (!revenueCatApiKey) {
    setRevenueCatConfigRequiredState();
    return;
  }

  if (!purchases) {
    purchases = Purchases.configure({
      apiKey: revenueCatApiKey,
      appUserId: user.id
    });
    purchasesUserId = user.id;
  } else if (purchasesUserId !== user.id) {
    await purchases.changeUser(user.id);
    purchasesUserId = user.id;
  }

  const customerInfo = await purchases.getCustomerInfo();
  subscribeBtn.disabled = false;
  checkPremiumStatus(customerInfo);
}

function checkPremiumStatus(customerInfo) {
  const managementURL = customerInfo.managementURL;
  if (manageSubscriptionLink) {
    manageSubscriptionLink.href = managementURL || '';
    manageSubscriptionLink.hidden = !managementURL;
  }

  // Replace 'premium_tutoring' with whatever Entitlement ID you choose in your dashboard
  if (customerInfo.entitlements.active['premium_tutoring']) {
    debugBox.innerHTML = "🎉 Welcome Premium Student! You now have full access to Algebra & Calculus.";
    debugBox.style.color = "blue";
    if (subscribeBtn) subscribeBtn.style.display = 'none'; // Hide buy button since they already own it
  } else {
    debugBox.innerHTML = "❌ You are currently on the Free Plan. Subscribe to unlock full modules.";
    debugBox.style.color = "orange";
  }
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase) return;

  const { error } = await supabase.auth.signInWithPassword({
    email: authEmail.value.trim(),
    password: authPassword.value
  });
  authStatus.textContent = error ? error.message : 'Signed in.';
});

signUpBtn.addEventListener('click', async () => {
  if (!supabase) return;
  if (!authForm.reportValidity()) return;
  if (!guardianConfirmation.checked) {
    authStatus.textContent = 'An adult or parent/guardian must create and manage accounts used by minors.';
    guardianConfirmation.focus();
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email: authEmail.value.trim(),
    password: authPassword.value
  });
  authStatus.textContent = error
    ? error.message
    : data.session
      ? 'Account created and signed in.'
      : 'Account created. Check your email to confirm, then sign in.';
});

signOutBtn.addEventListener('click', async () => {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  authStatus.textContent = error ? error.message : 'You are signed out.';
});

if (subscribeBtn) {
  subscribeBtn.addEventListener('click', async () => {
    if (!revenueCatApiKey || !purchases) {
      setRevenueCatConfigRequiredState();
      return;
    }

    try {
      debugBox.innerHTML = "Loading premium offers...";

      const offerings = await purchases.getOfferings();
      const availableOfferings = Object.values(offerings.all ?? {});
      const weeklyOffering = [offerings.current, ...availableOfferings].find((candidate) =>
        candidate?.availablePackages?.some((availablePackage) => availablePackage.packageType === 'WEEKLY')
      );
      const offering = weeklyOffering ?? offerings.current ?? availableOfferings[0] ?? null;

      if (!offering) {
        throw new Error('No offering found. Create an offering in RevenueCat and publish it before opening checkout.');
      }

      // Launches the secure Stripe Sandbox overlay using the actual offering
      const { customerInfo } = await purchases.presentPaywall({ offering });

      // Check if they successfully bought it after closing checkout
      checkPremiumStatus(customerInfo);

    } catch (error) {
      const message = error?.message || String(error);

      if (message.includes('No offering found') || message.includes('offering') || message.includes('not configured')) {
        debugBox.innerHTML = 'RevenueCat is configured, but no valid offering is available yet. Create and publish a current offering in the RevenueCat dashboard.';
        debugBox.style.color = 'orange';
        return;
      }

      debugBox.innerHTML = `Checkout closed or failed: ${message}`;
      debugBox.style.color = "red";
    }
  });
}

async function initAuth() {
  if (!supabase) {
    authForm.querySelectorAll('input, button').forEach((control) => {
      control.disabled = true;
    });
    authStatus.textContent = 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file to enable sign-in.';
    setSignedOutState();
    if (!revenueCatApiKey) {
      setRevenueCatConfigRequiredState();
    }
    return;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await syncAuthSession(data.session);

    supabase.auth.onAuthStateChange((_event, session) => {
      void syncAuthSession(session).catch((error) => {
        console.error('Could not sync the signed-in customer with RevenueCat:', error);
        authStatus.textContent = 'Signed in, but subscription status could not be loaded.';
        subscribeBtn.disabled = true;
      });
    });
  } catch (error) {
    console.error('Sign-in initialization error:', error);
    authStatus.textContent = `Could not initialize sign-in: ${error.message}`;
    setSignedOutState();
  }
}

initAuth();

