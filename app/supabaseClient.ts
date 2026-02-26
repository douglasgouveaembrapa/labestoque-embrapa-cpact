// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

// Substitua pelos seus dados do Supabase (Settings -> API)
const supabaseUrl = 'https://skzdlnyugbhlpybyuabi.supabase.co'
const supabaseKey = 'sb_publishable_pUQ6LoKB9T_O1snthHJC-g_IMBVkq4A'

export const supabase = createClient(supabaseUrl, supabaseKey)