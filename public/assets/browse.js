import { supabase } from '../supabaseConfig.js';

const messListingsContainer = document.getElementById('messListings');
const loadingIndicator = document.getElementById('loadingMesses');
const searchCollegeInput = document.getElementById('searchCollege');
const searchLocationInput = document.getElementById('searchLocation');
const maxPriceInput = document.getElementById('maxPrice');

let allMesses = []; 

// --- 1. Helper: Debounce Function ---
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// --- 2. Helper: Star Rating HTML ---
function getStarRatingHTML(rating) {
  const fullStars = Math.floor(rating || 0);
  const halfStar = (rating % 1) >= 0.5 ? 1 : 0;
  const emptyStars = 5 - fullStars - halfStar;
  
  let starsHTML = '';
  // Full stars
  for(let i = 0; i < fullStars; i++) {
    starsHTML += `<svg class="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>`;
  }
  // Half star
  if (halfStar) {
    starsHTML += `<svg class="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674zM10 15.172l3.4 1.953-1.305-3.99a1 1 0 01.363-1.118l3.4-2.47-3.99-.001a1 1 0 01-.95-.69L10 5.173V15.172z"/></svg>`;
  }
  // Empty stars
  for(let i = 0; i < emptyStars; i++) {
    starsHTML += `<svg class="h-4 w-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>`;
  }
  return starsHTML;
}

// --- 3. Core Logic: Fetch Data ---
async function fetchAllMesses() {
    if (!messListingsContainer) return;
    loadingIndicator.style.display = 'block';
    
    try {
        // A. Fetch Mess Info
        const { data: messInfos, error: messInfoError } = await supabase.from('mess_info').select('*');
        if (messInfoError) throw messInfoError;

        // B. Fetch Plans
        const { data: allPlans, error: plansError } = await supabase.from('plans').select('*');
        if (plansError) throw plansError;
        
        // C. Fetch Reviews 
        const { data: allReviews, error: reviewsError } = await supabase.from('reviews').select('*');
        // If reviews table is empty or errored, default to empty array to prevent crash
        const safeReviews = reviewsError ? [] : (allReviews || []);

        // D. Fetch User Names for Reviews
        let reviewerMap = new Map();
        if (safeReviews.length > 0) {
            const userIds = [...new Set(safeReviews.map(r => r.user_id).filter(id => id))];
            if (userIds.length > 0) {
                const { data: users } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
                if (users) {
                    users.forEach(u => reviewerMap.set(u.id, u.full_name));
                }
            }
        }

        // E. Combine Data & Calculate Ratings
        allMesses = messInfos.map(mess => {
            const messPlans = allPlans.filter(plan => plan.mess_id === mess.mess_id);
            const messReviews = safeReviews.filter(r => r.mess_id === mess.mess_id).map(r => ({
                ...r,
                student_name: reviewerMap.get(r.user_id) || 'Anonymous'
            }));
            
            // Important: Calculate rating here so it exists for the render function
            const avgRating = messReviews.length > 0 
                ? messReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / messReviews.length 
                : 0;

            return {
                ...mess,
                plans: messPlans,
                reviews: messReviews,
                avgRating: avgRating,
                reviewCount: messReviews.length
            };
        });

        renderMesses(allMesses);

    } catch (err) {
        console.error('Error fetching messes:', err);
        messListingsContainer.innerHTML = `
            <div class="col-span-full text-center py-10">
                <p class="text-red-500 font-semibold">Could not load messes.</p>
                <p class="text-sm text-gray-500 mt-2">Please try again later.</p>
            </div>`;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// --- 4. Core Logic: Render Cards ---
function renderMesses(messes) {
    messListingsContainer.innerHTML = ''; 
    
    if (!messes || messes.length === 0) {
        messListingsContainer.innerHTML = '<p class="text-center text-gray-500 col-span-full py-10">No messes found matching your criteria.</p>';
        return;
    }

    messes.forEach(mess => {
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition flex flex-col justify-between';
        if (typeof AOS !== 'undefined') card.setAttribute('data-aos', 'fade-up');

        // Plans HTML
        let plansHtml = '<p class="text-sm text-gray-500 mt-2">No plans available.</p>';
        if (mess.plans && mess.plans.length > 0) {
             mess.plans.sort((a, b) => a.price - b.price);
            plansHtml = '<ul class="mt-2 space-y-1 text-sm">';
            mess.plans.slice(0, 3).forEach(plan => { 
                plansHtml += `<li class="flex justify-between"><span>${plan.name}</span> <span class="font-semibold">₹${plan.price}</span></li>`;
            });
            plansHtml += '</ul>';
        }

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-bold text-gray-800 truncate pr-2">${mess.mess_name || 'Unnamed Mess'}</h3>
                    <div class="flex items-center bg-yellow-50 px-2 py-1 rounded border border-yellow-100 flex-shrink-0">
                        <span class="text-yellow-700 font-bold mr-1 text-sm">${mess.avgRating.toFixed(1)}</span>
                        <svg class="h-3 w-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                    </div>
                </div>
                
                <p class="text-sm text-gray-600 mb-1"><span class="font-semibold">College:</span> ${mess.nearby_college || 'N/A'}</p>
                <p class="text-sm text-gray-600 mb-3"><span class="font-semibold">Contact:</span> ${mess.email || 'N/A'}</p>
                
                ${mess.location_link ? `<a href="${mess.location_link}" target="_blank" class="text-xs text-blue-600 hover:underline mb-4 inline-flex items-center"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg> View Location</a>` : ''}
                
                <div class="border-t border-b py-3 my-2">
                    <h4 class="text-xs font-semibold text-gray-500 uppercase mb-2">Available Plans</h4>
                    ${plansHtml}
                </div>

                <button class="w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition font-medium mb-2 view-reviews-btn" data-mess-id="${mess.mess_id}">
                    See all ${mess.reviewCount} reviews
                </button>
            </div>
            
             <a href="register.html?mess_id=${mess.mess_id}" class="mt-2 block text-center bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                Register Here
            </a>
        `;
        messListingsContainer.appendChild(card);
    });
    
    if (typeof AOS !== 'undefined') {
        setTimeout(() => AOS.refresh(), 100); 
    }
}

// --- 5. Filter Logic ---
const filterMesses = debounce(() => {
    const collegeQuery = searchCollegeInput.value.toLowerCase().trim();
    const locationQuery = searchLocationInput.value.toLowerCase().trim();
    const maxPrice = parseFloat(maxPriceInput.value);

    const filtered = allMesses.filter(mess => {
        const collegeMatch = !collegeQuery || (mess.nearby_college && mess.nearby_college.toLowerCase().includes(collegeQuery));
        const locationMatch = !locationQuery || (mess.location_link && mess.location_link.toLowerCase().includes(locationQuery));
        const priceMatch = isNaN(maxPrice) || !mess.plans || mess.plans.length === 0 || mess.plans.some(plan => plan.price <= maxPrice);

        return collegeMatch && locationMatch && priceMatch;
    });

    renderMesses(filtered);
}, 300);

// --- 6. Review Modal Logic ---
const reviewModal = document.getElementById('reviewModal');
const reviewModalTitle = document.getElementById('reviewModalTitle');
const reviewModalBody = document.getElementById('reviewModalBody');
const closeReviewModalBtn = document.getElementById('closeReviewModalBtn');

function toggleModal(show) {
    if (!reviewModal) return;
    if (show) {
        reviewModal.classList.remove('hidden');
        reviewModal.classList.add('flex');
    } else {
        reviewModal.classList.add('hidden');
        reviewModal.classList.remove('flex');
    }
}

if (closeReviewModalBtn) {
    closeReviewModalBtn.addEventListener('click', () => toggleModal(false));
}
if (reviewModal) {
    reviewModal.addEventListener('click', (e) => {
        if (e.target === reviewModal) toggleModal(false);
    });
}

messListingsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('view-reviews-btn')) {
        const messId = e.target.dataset.messId;
        const mess = allMesses.find(m => m.mess_id == messId);
        
        if (mess) {
            if (reviewModalTitle) reviewModalTitle.textContent = `Reviews for ${mess.mess_name}`;
            if (reviewModalBody) {
                if (mess.reviews && mess.reviews.length > 0) {
                    reviewModalBody.innerHTML = mess.reviews.map(r => `
                        <div class="border-b pb-4 last:border-0">
                            <div class="flex justify-between items-center mb-1">
                                <span class="font-bold text-gray-800 text-sm">${r.student_name}</span>
                                <div class="flex">${getStarRatingHTML(r.rating)}</div>
                            </div>
                            <p class="text-gray-600 text-sm italic">"${r.review_text || 'No comment'}"</p>
                            <p class="text-xs text-gray-400 mt-2">${new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                    `).join('');
                } else {
                    reviewModalBody.innerHTML = `
                        <div class="text-center py-8">
                            <svg class="h-12 w-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                            <p class="text-gray-500">No reviews yet for this mess.</p>
                        </div>`;
                }
            }
            toggleModal(true);
        }
    }
});

// --- 7. Initialization ---
if (searchCollegeInput) searchCollegeInput.addEventListener('input', filterMesses);
if (searchLocationInput) searchLocationInput.addEventListener('input', filterMesses);
if (maxPriceInput) maxPriceInput.addEventListener('input', filterMesses);

document.addEventListener('DOMContentLoaded', fetchAllMesses);