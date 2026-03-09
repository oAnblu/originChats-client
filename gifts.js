// Gift creation modal

function openGiftModal() {
	document.getElementById('upload-dropdown').style.display = 'none';
	const modal = document.getElementById('gift-modal');
	if (!modal) {
		console.error('Gift modal not found');
		return;
	}
	modal.classList.add('active');
	updateGiftSummary();
}

function closeGiftModal() {
	const modal = document.getElementById('gift-modal');
	if (modal) {
		modal.classList.remove('active');
	}
	const amountInput = document.getElementById('gift-amount');
	const noteInput = document.getElementById('gift-note');
	if (amountInput) amountInput.value = '';
	if (noteInput) noteInput.value = '';
	const defaultExpiry = document.querySelector('input[name="gift-expiry"][value="0"]');
	if (defaultExpiry) defaultExpiry.checked = true;
}

function updateGiftSummary() {
	const amount = parseFloat(document.getElementById('gift-amount')?.value) || 0;
	const tax = amount * 0.01;
	const total = amount + tax;

	const summaryAmount = document.getElementById('summary-amount');
	const summaryTax = document.getElementById('summary-tax');
	const summaryTotal = document.getElementById('summary-total');

	if (summaryAmount) summaryAmount.textContent = `${amount.toFixed(2)} RC`;
	if (summaryTax) summaryTax.textContent = `${tax.toFixed(2)} RC`;
	if (summaryTotal) summaryTotal.textContent = `${total.toFixed(2)} RC`;
}

async function submitGift() {
	const amount = parseFloat(document.getElementById('gift-amount')?.value);
	const note = document.getElementById('gift-note')?.value || '';
	const expiryInput = document.querySelector('input[name="gift-expiry"]:checked');
	const expiryHrs = parseInt(expiryInput?.value || '0');
	const btn = document.getElementById('submit-gift-btn');

	if (!amount || amount <= 0) {
		if (window.showError) window.showError('Please enter a valid amount');
		return;
	}

	if (btn) {
		btn.disabled = true;
		btn.textContent = 'Creating...';
	}

	try {
		const token = window.state?.token;
		if (!token) {
			throw new Error('Not authenticated');
		}

		const response = await fetch('https://api.rotur.dev/gifts/create?auth=' + encodeURIComponent(token), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				amount,
				note,
				expires_in_hrs: expiryHrs
			})
		});

		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || 'Failed to create gift');
		}

		const input = document.getElementById('message-input');
		const giftUrl = `https://rotur.dev/gift?code=${data.code}`;
		const currentText = input?.value?.trim() || '';
		if (input) {
			input.value = currentText ? `${currentText}\n${giftUrl}` : giftUrl;
			input.focus();
		}

		closeGiftModal();
		if (window.showNotification) window.showNotification(`Gift created! Code: ${data.code}`);

	} catch (error) {
		if (window.showError) window.showError(error.message);
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.textContent = 'Create Gift';
		}
	}
}

// Gift embed rendering (for chat messages)

async function createGiftEmbed(giftCode, originalUrl) {
	const container = document.createElement('div');
	container.className = 'embed-container gift-embed';

	try {
		const response = await fetch(`https://api.rotur.dev/gifts/${giftCode}`);
		if (!response.ok) throw new Error('Gift not found');

		const data = await response.json();
		if (!data.gift) throw new Error('Invalid gift response');

		const gift = data.gift;

		const giftCard = document.createElement('div');
		giftCard.className = 'gift-card';

		const cardHeader = document.createElement('div');
		cardHeader.className = 'gift-card-header';

		const giftIcon = document.createElement('div');
		giftIcon.className = 'gift-icon';
		giftIcon.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>`;

		const cardTitle = document.createElement('div');
		cardTitle.className = 'gift-card-title';
		cardTitle.textContent = 'Rotur Gift';

		cardHeader.appendChild(giftIcon);
		cardHeader.appendChild(cardTitle);

		const cardBody = document.createElement('div');
		cardBody.className = 'gift-card-body';

		const amountDisplay = document.createElement('div');
		amountDisplay.className = 'gift-amount';
		amountDisplay.textContent = `${gift.amount.toFixed(2)} RC`;

		cardBody.appendChild(amountDisplay);

		if (gift.note) {
			const noteDisplay = document.createElement('div');
			noteDisplay.className = 'gift-note';
			noteDisplay.textContent = gift.note;
			cardBody.appendChild(noteDisplay);
		}

		if (gift.expires_at) {
			const expiryDisplay = document.createElement('div');
			expiryDisplay.className = 'gift-expiry';
			const expiryDate = new Date(gift.expires_at);
			expiryDisplay.textContent = `Expires: ${expiryDate.toLocaleDateString()}`;
			cardBody.appendChild(expiryDisplay);
		}

		giftCard.appendChild(cardHeader);
		giftCard.appendChild(cardBody);

		if (!gift.claimed_at && !gift.cancelled_at && !gift.is_expired) {
			const claimBtn = document.createElement('button');
			claimBtn.className = 'gift-claim-btn';
			claimBtn.textContent = 'Claim Gift';
			claimBtn.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				claimGiftBtn(claimBtn, giftCode, giftCard);
			};
			giftCard.appendChild(claimBtn);
		} else if (gift.claimed_at) {
			const statusBadge = document.createElement('div');
			statusBadge.className = 'gift-status claimed';
			statusBadge.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Claimed`;
			giftCard.appendChild(statusBadge);
		} else if (gift.cancelled_at) {
			const statusBadge = document.createElement('div');
			statusBadge.className = 'gift-status cancelled';
			statusBadge.textContent = 'Cancelled';
			giftCard.appendChild(statusBadge);
		} else if (gift.is_expired) {
			const statusBadge = document.createElement('div');
			statusBadge.className = 'gift-status expired';
			statusBadge.textContent = 'Expired';
			giftCard.appendChild(statusBadge);
		}

		container.appendChild(giftCard);
	} catch (error) {
		const errorCard = document.createElement('div');
		errorCard.className = 'gift-card gift-error';
		errorCard.innerHTML = `
			<div class="gift-card-header">
				<div class="gift-icon">
					<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
				</div>
				<div class="gift-card-title">Gift Not Found</div>
			</div>
		`;
		container.appendChild(errorCard);
	}

	return container;
}

async function claimGiftBtn(btn, giftCode, card) {
	btn.disabled = true;
	btn.textContent = 'Claiming...';

	try {
		const token = window.state?.token;
		if (!token) {
			throw new Error('Not authenticated');
		}

		const response = await fetch(`https://api.rotur.dev/gifts/claim/${giftCode}?auth=${encodeURIComponent(token)}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || 'Failed to claim gift');
		}

		btn.textContent = 'Claimed!';
		btn.style.background = 'var(--success, #3ba55c)';

		setTimeout(() => {
			const statusBadge = document.createElement('div');
			statusBadge.className = 'gift-status claimed';
			statusBadge.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Claimed`;
			btn.replaceWith(statusBadge);
		}, 1000);

	} catch (error) {
		btn.disabled = false;
		btn.textContent = error.message || 'Failed to claim';
		btn.style.background = 'var(--danger, #ed4245)';
	}
}

// Export functions
window.openGiftModal = openGiftModal;
window.closeGiftModal = closeGiftModal;
window.updateGiftSummary = updateGiftSummary;
window.submitGift = submitGift;
window.createGiftEmbed = createGiftEmbed;
window.claimGiftBtn = claimGiftBtn;
