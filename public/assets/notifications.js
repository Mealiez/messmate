export function showToast(message, type = 'info') {
  const toastContainer = getOrCreateToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast-notification ${type} animate-slide-in`;

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  const icons = {
    success: `<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
    </svg>`,
    error: `<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
    </svg>`,
    warning: `<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
    </svg>`,
    info: `<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>`
  };

  toast.innerHTML = `
    <div class="${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg flex items-center max-w-md">
      <div class="mr-3">
        ${icons[type]}
      </div>
      <p class="font-semibold">${message}</p>
      <button class="ml-4 hover:opacity-75" onclick="this.parentElement.parentElement.remove()">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('animate-slide-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function getOrCreateToastContainer() {
  let container = document.getElementById('toast-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-4 right-4 z-50 space-y-4';

    const style = document.createElement('style');
    style.textContent = `
      .animate-slide-in {
        animation: slideIn 0.3s ease-out;
      }
      .animate-slide-out {
        animation: slideOut 0.3s ease-in;
      }
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(container);
  }

  return container;
}

export function showPaymentDueNotification(dueDate, amount) {
  const daysUntilDue = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue <= 3 && daysUntilDue > 0) {
    showToast(`Payment of ₹${amount} due in ${daysUntilDue} day(s)`, 'warning');
  } else if (daysUntilDue <= 0) {
    showToast(`Payment of ₹${amount} is overdue!`, 'error');
  }
}

export function showAttendanceMarkedNotification() {
  showToast('Attendance marked successfully!', 'success');
}
