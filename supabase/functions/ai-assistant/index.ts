// supabase/functions/ai-assistant/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { query } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // --- STEP A: INTELLIGENT SEARCH ---
    let databaseData = "No specific database data found.";
    const lowerQuery = query.toLowerCase();

    // Intent 1: "Best Mess" / Ranking / Recommendations
    if (lowerQuery.includes('best') || lowerQuery.includes('top') || lowerQuery.includes('mess') || lowerQuery.includes('find') || lowerQuery.includes('rating')) {
       
       // 1. Query the VIEW (view_mess_rankings) instead of the raw table
       let dbQuery = supabaseClient
         .from('view_mess_rankings')
         .select('*')
         .order('average_rating', { ascending: false }) // Sort by highest rating
         .limit(3);

       // 2. Filter by College (if mentioned)
       const colleges = ['coep', 'mit', 'pict', 'viit', 'dy patil'];
       const detectedCollege = colleges.find(c => lowerQuery.includes(c));
       if (detectedCollege) {
          dbQuery = dbQuery.ilike('nearby_college', `%${detectedCollege}%`);
       }

       const { data, error } = await dbQuery;

       if (!error && data && data.length > 0) {
          databaseData = "Top Rated Messes Found:\n" + 
            data.map((m: any) => 
              `- ${m.mess_name} (${m.nearby_college}) | ⭐ ${m.average_rating}/5 (${m.review_count} reviews) | Contact: ${m.email}`
            ).join('\n');
       } else {
          databaseData = "I searched for messes but couldn't find any matching results with ratings yet.";
       }
    }
    
    // Intent 2: Menu Search (Stays the same)
    else if (lowerQuery.includes('menu') || lowerQuery.includes('lunch') || lowerQuery.includes('dinner')) {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabaseClient
            .from('menu')
            .select('date, breakfast, lunch, dinner, mess_info!inner(mess_name)')
            .eq('date', today)
            .limit(3);
            
        if (!error && data && data.length > 0) {
           databaseData = "Today's Menus:\n" + 
             data.map((m: any) => `- ${m.mess_info.mess_name}: Lunch: ${m.lunch}, Dinner: ${m.dinner}`).join('\n');
        }
    }

    // --- STEP B: GEMINI AI REQUEST ---
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    let aiResponse = "";

    if (!geminiKey) {
      aiResponse = `[System Mode] I found this info:\n\n${databaseData}\n\n(To enable AI chat, set GEMINI_API_KEY in Supabase secrets).`;
    } else {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        You are Mealiez AI, the smart assistant for finding student food.
        User Query: "${query}"
        
        Real-time Database Info:
        ${databaseData}
        
        Instructions:
        1. If the user asks for the "best" or "top" mess, USE the Star Rating (⭐) from the data to recommend.
        2. Mention the rating and review count to justify your recommendation.
        3. Keep the tone helpful and student-friendly.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      aiResponse = response.text();
    }

    return new Response(
      JSON.stringify({ answer: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ answer: "System Error: " + (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})