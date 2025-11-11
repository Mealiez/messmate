import { supabase } from '../supabaseConfig.js';

const messListingsContainer = document.getElementById('messListings');
const loadingIndicator = document.getElementById('loadingMesses');
const searchCollegeInput = document.getElementById('searchCollege');
const searchLocationInput = document.getElementById('searchLocation');
const maxPriceInput = document.getElementById('maxPrice');

let allMesses = []; // To store fetched data

// Debounce function
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

// --- NEW FUNCTION: To render star ratings ---
function getStarRatingHTML(rating) {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5 ? 1 : 0;
  const emptyStars = 5 - fullStars - halfStar;
  
  let starsHTML = '';
  
  // Full stars
  for(let i = 0; i < fullStars; i++) {
    starsHTML += `<svg class="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>`;
  }
  // Half star
  if (halfStar) {
    starsHTML += `<svg class="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674zM10 15.172l3.4 1.953-1.305-3.99a1 1 0 01.363-1.118l3.4-2.47-3.99-.001a1 1 0 01-.95-.69L10 5.173V15.172z"/></svg>`;
  }
  // Empty stars
  for(let i = 0; i < emptyStars; i++) {
    starsHTML += `<svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>`;
  }
  
  return starsHTML;
}

// Function to render mess cards
function renderMesses(messes) {
    messListingsContainer.innerHTML = ''; // Clear previous listings
    if (!messes || messes.length === 0) {
        messListingsContainer.innerHTML = '<p class="text-center text-gray-500 col-span-full">No messes found matching your criteria.</p>';
        return;
    }

    messes.forEach(mess => {
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition flex flex-col justify-between';
        card.setAttribute('data-aos', 'fade-up');

        let plansHtml = '<p class="text-sm text-gray-500 mt-2">No plans available.</p>';
        if (mess.plans && mess.plans.length > 0) {
             mess.plans.sort((a, b) => a.price - b.price);
            plansHtml = '<ul class="mt-2 space-y-1 text-sm">';
            mess.plans.forEach(plan => {
                plansHtml += `<li class="flex justify-between"><span>${plan.name} (${plan.duration_days} days)</span> <span class="font-semibold">₹${plan.price}</span></li>`;
            });
            plansHtml += '</ul>';
        }

        // --- NEW: Rating HTML ---
        const ratingHTML = `
          <div class="flex items-center mt-2">
            ${getStarRatingHTML(mess.avgRating)}
            <span class="ml-2 text-sm text-gray-600">(${mess.reviewCount} reviews)</span>
          </div>
        `;

        card.innerHTML = `
            <div>
                <h3 class="text-xl font-bold text-gray-800 mb-2">${mess.mess_name || 'Unnamed Mess'}</h3>
                ${ratingHTML} <p class="text-sm text-gray-600 mb-1 mt-3"><span class="font-semibold">College:</span> ${mess.nearby_college || 'N/A'}</p>
                <p class="text-sm text-gray-600 mb-1"><span class="font-semibold">Contact:</span> ${mess.email || 'N/A'}</p>
                ${mess.location_link ? `<a href="${mess.location_link}" target="_blank" rel="noopener noreferrer" class="text-sm text-blue-600 hover:underline inline-block mb-3">View Location</a>` : '<p class="text-sm text-gray-400 mb-3">Location not provided</p>'}
                <h4 class="text-md font-semibold text-gray-700 mt-3 border-t pt-2">Available Plans:</h4>
                ${plansHtml}
            </div>
             <a href="register.html?mess_id=${mess.mess_id}" class="mt-4 block text-center bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                Register Here
            </a>
        `;
        messListingsContainer.appendChild(card);
    });
    
    if (typeof AOS !== 'undefined') {
        AOS.refresh();
    }
}

// Function to filter messes based on input
const filterMesses = debounce(() => {
    const collegeQuery = searchCollegeInput.value.toLowerCase().trim();
    const locationQuery = searchLocationInput.value.toLowerCase().trim();
    const maxPrice = parseFloat(maxPriceInput.value);

    const filtered = allMesses.filter(mess => {
        const collegeMatch = !collegeQuery || (mess.nearby_college && mess.nearby_college.toLowerCase().includes(collegeQuery));
        const locationMatch = !locationQuery; // Location search is complex, can be improved later
        
        const priceMatch = isNaN(maxPrice) || !mess.plans || mess.plans.length === 0 || mess.plans.some(plan => plan.price <= maxPrice);

        return collegeMatch && locationMatch && priceMatch;
    });

    renderMesses(filtered);
}, 300);

// --- UPDATED: Initial data fetch logic ---
async function fetchAllMesses() {
    loadingIndicator.style.display = 'block';
    messListingsContainer.innerHTML = '';

    try {
        // Step 1: Fetch all mess info
        const { data: messInfos, error: messInfoError } = await supabase.from('mess_info').select('*');
        if (messInfoError) throw messInfoError;

        // Step 2: Fetch all plans
        const { data: allPlans, error: plansError } = await supabase.from('plans').select('*');
        if (plansError) throw plansError;
        
        // --- NEW: Step 3: Fetch all reviews ---
        const { data: allReviews, error: reviewsError } = await supabase.from('reviews').select('mess_id, rating');
        if (reviewsError) throw reviewsError;

        // Step 4: Combine the data
        allMesses = messInfos.map(mess => {
            // Filter plans for this mess
            const messPlans = allPlans.filter(plan => plan.mess_id === mess.mess_id);
            
            // Filter reviews for this mess
            const messReviews = allReviews.filter(r => r.mess_id === mess.mess_id);
            
            // Calculate average rating
            const reviewCount = messReviews.length;
            const avgRating = reviewCount > 0
              ? (messReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount)
              : 0;

            return {
                ...mess,
                plans: messPlans,
                reviews: messReviews,
                avgRating: avgRating,
                reviewCount: reviewCount
            };
        });

        renderMesses(allMesses);

    } catch (err) {
        console.error('Error fetching messes:', err);
        messListingsContainer.innerHTML = '<p class="text-center text-red-500 col-span-full">Could not load messes. Please try again later.</p>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Add event listeners for filters
searchCollegeInput.addEventListener('input', filterMesses);
searchLocationInput.addEventListener('input', filterMesses);
maxPriceInput.addEventListener('input', filterMesses);

// Load data when the page loads
document.addEventListener('DOMContentLoaded', fetchAllMesses);