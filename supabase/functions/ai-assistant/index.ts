// supabase/functions/ai-assistant/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- 1. KNOWLEDGE BASE (For "How-To" Questions) ---
const APP_MANUAL = `
**How to Update Menu:**
1. Go to the 'Menu' tab.
2. Select a date.
3. Enter items for Breakfast, Lunch, Dinner.
4. Click 'Update Menu'.

**How to Mark Attendance:**
1. Go to 'Attendance'.
2. Select Meal Type.
3. Scan QR or search student name.
4. Toggle to 'Present'.

**How to Add Student:**
1. Go to 'Students' tab.
2. Click '+ Add Student'.
3. Enter Name, Mobile, Plan Type.
4. Click 'Save'.

**How to Check Payments:**
1. Go to 'Payments'.
2. Click on a student to see history or add new payment.

**How to View Reports:**
1. Click 'Reports' in sidebar.
2. Toggle between Monthly/Daily views.
`;

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { query } = await req.json()
    
    // --- 2. SETUP ---
    // Initialize Supabase with User Auth Context (Critical for Admin Actions)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    // Get the logged-in user (Mess Owner)
    const { data: { user } } = await supabaseClient.auth.getUser()

    // Initialize Gemini AI
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error("GEMINI_API_KEY is missing");
    
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // --- 3. INTENT ANALYSIS (The Brain) ---
    // We ask AI to categorize the request into Action (JSON) or Chat.
    const systemPrompt = `
      Current Date: ${new Date().toISOString().split('T')[0]}
      User Query: "${query}"

      Analyze the query and return a strict JSON object.

      SCENARIO 1: Add Payment
      - Example: "Add 500 rs payment for Ramesh"
      - JSON: {"action": "add_payment", "student_name": "Ramesh", "amount": 500, "date": "YYYY-MM-DD"}

      SCENARIO 2: Add/Update Menu
      - Example: "Add Idli for breakfast on 21 Jan"
      - JSON: {"action": "add_menu", "date": "YYYY-MM-DD", "meal_type": "breakfast", "food_item": "Idli"}
      - Note: meal_type must be "breakfast", "lunch", or "dinner".

      SCENARIO 3: Add Plan
      - Example: "Add monthly plan 2500rs for 30 days"
      - JSON: {"action": "add_plan", "name": "Monthly Plan", "price": 2500, "duration": 30}
      - Note: If name is missing, infer a short one.

      SCENARIO 4: General Chat / Search / Help
      - Example: "How to add student?", "Best mess in COEP", "Show menu"
      - JSON: {"action": "chat"}

      Return ONLY valid JSON.
    `;

    const intentResult = await model.generateContent(systemPrompt);
    let textResult = intentResult.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    
    let intent;
    try { intent = JSON.parse(textResult); } catch (e) { intent = { action: "chat" }; }

    let finalResponse = "";

    // --- 4. EXECUTE ACTIONS (If Intent is Action) ---

    // === ACTION: ADD PAYMENT ===
    if (intent.action === "add_payment") {
        if (!user) {
            finalResponse = "Please log in to add payments.";
        } else {
            const { student_name, amount, date } = intent;
            // Search for student in THIS mess only
            const { data: students } = await supabaseClient
                .from('students')
                .select('id, name')
                .eq('mess_id', user.id)
                .ilike('name', `%${student_name}%`);

            if (!students || students.length === 0) {
                finalResponse = `❌ Student "${student_name}" not found in your mess.`;
            } else if (students.length > 1) {
                finalResponse = `⚠️ Found multiple students named "${student_name}". Please be specific.`;
            } else {
                const { error } = await supabaseClient.from('payments').insert({
                    mess_id: user.id,
                    student_id: students[0].id,
                    total_amount: 0,
                    paid_amount: amount,
                    last_paid_transaction: amount,
                    paid_on: date,
                    status: 'Paid',
                    due_date: date
                });
                if (error) finalResponse = `Error: ${error.message}`;
                else finalResponse = `✅ Payment of ₹${amount} saved for **${students[0].name}** on ${date}.`;
            }
        }
    }

    // === ACTION: ADD MENU ===
    else if (intent.action === "add_menu") {
        if (!user) {
            finalResponse = "Please log in to manage the menu.";
        } else {
            const { date, meal_type, food_item } = intent;
            
            // Fetch existing to prevent overwriting other meals
            const { data: existingMenu } = await supabaseClient
                .from('menu')
                .select('*')
                .eq('mess_id', user.id)
                .eq('date', date)
                .maybeSingle();

            const updates: any = {
                mess_id: user.id,
                date: date,
                breakfast: existingMenu?.breakfast || "",
                lunch: existingMenu?.lunch || "",
                dinner: existingMenu?.dinner || ""
            };

            // Update specific field
            if (meal_type === 'breakfast') updates.breakfast = food_item;
            if (meal_type === 'lunch') updates.lunch = food_item;
            if (meal_type === 'dinner') updates.dinner = food_item;

            const { error } = await supabaseClient
                .from('menu')
                .upsert(updates, { onConflict: 'mess_id, date' });

            if (error) finalResponse = `Error: ${error.message}`;
            else finalResponse = `✅ Menu updated for **${date}**.\n${meal_type}: "${food_item}"`;
        }
    }

    // === ACTION: ADD PLAN ===
    else if (intent.action === "add_plan") {
        if (!user) {
            finalResponse = "Please log in to manage plans.";
        } else {
            const { name, price, duration } = intent;
            const { error } = await supabaseClient.from('plans').insert({
                mess_id: user.id,
                name: name,
                price: price,
                duration_days: duration
            });

            if (error) finalResponse = `Error: ${error.message}`;
            else finalResponse = `✅ Plan "**${name}**" added.\nPrice: ₹${price}, Duration: ${duration} days.`;
        }
    }

    // --- 5. HANDLE CHAT / SEARCH (If Intent is 'chat') ---
    else {
        // Prepare Context based on question type
        const lowerQuery = query.toLowerCase();
        let contextData = "";
        let instructions = "";

        // A. Is it a "How-to" / Tutorial Question?
        if (lowerQuery.includes('how to') || lowerQuery.includes('how do i') || lowerQuery.includes('guide')) {
            contextData = APP_MANUAL;
            instructions = "Use the 'App Manual' to guide the user step-by-step. Keep it short.";
        } 
        // B. Is it a "Data Search" Question? (Best Mess, Menu, etc.)
        else {
            // Search Best Mess
            if (lowerQuery.includes('best') || lowerQuery.includes('mess') || lowerQuery.includes('rating')) {
                let dbQuery = supabaseClient
                    .from('view_mess_rankings') // Assuming View exists
                    .select('*')
                    .order('average_rating', { ascending: false })
                    .limit(3);
                
                // College Filter
                const colleges = ['coep', 'mit', 'pict', 'viit'];
                const detectedCollege = colleges.find(c => lowerQuery.includes(c));
                if (detectedCollege) dbQuery = dbQuery.ilike('nearby_college', `%${detectedCollege}%`);

                const { data } = await dbQuery;
                if (data) contextData += `Found Messes: ${JSON.stringify(data)}\n`;
            }
            
            // Search Menu
            if (lowerQuery.includes('menu') || lowerQuery.includes('food')) {
                const today = new Date().toISOString().split('T')[0];
                const { data } = await supabaseClient
                    .from('menu')
                    .select('date, breakfast, lunch, dinner, mess_info(mess_name)')
                    .eq('date', today)
                    .limit(3);
                if (data) contextData += `Today's Menu: ${JSON.stringify(data)}\n`;
            }
            
            instructions = "Answer naturally using the Database Data found. If no data, be polite.";
        }

        // Final Generation for Chat
        const chatPrompt = `
            You are Mealiez AI.
            User Query: "${query}"
            
            Context Data:
            ${contextData || "No specific database data found."}

            Instructions: ${instructions}
        `;

        const chatResult = await model.generateContent(chatPrompt);
        finalResponse = chatResult.response.text();
    }

    return new Response(
      JSON.stringify({ answer: finalResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ answer: "System Error: " + (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})