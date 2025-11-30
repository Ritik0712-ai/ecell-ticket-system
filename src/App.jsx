import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  onSnapshot, 
  query, 
  serverTimestamp,
  getDoc 
} from 'firebase/firestore';
import { 
  Ticket, 
  Scan, 
  BarChart3, 
  RefreshCcw,
  ShieldCheck,
  Mail
} from 'lucide-react';

/* ------------------------------------------------------------------
 * PRODUCTION CONFIG (VERCEL)
 * This works because Vercel injects the VITE_ variables during build.
 * ------------------------------------------------------------------ */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// SECRET SALT 
const SECRET_SALT = "E-CELL-PRODUCTION-SECRET"; 

// --- Utilities ---

const generateSignature = (data) => {
  const str = JSON.stringify(data) + SECRET_SALT;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

const QRCodeImage = ({ data, size = 150 }) => {
  const encoded = encodeURIComponent(data);
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
  return (
    <div className="bg-white p-2 rounded-lg inline-block border-2 border-slate-200">
      <img src={url} alt="QR Ticket" className="block" width={size} height={size} />
    </div>
  );
};

// --- Main App ---

export default function TicketSystem() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard'); 
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dashboard State
  const [newParticipant, setNewParticipant] = useState({ name: '', email: '', type: 'Standard' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Verifier State
  const [scanInput, setScanInput] = useState('');
  const [verificationResult, setVerificationResult] = useState(null); 
  const [verifying, setVerifying] = useState(false);

  // Auth
  useEffect(() => {
    signInAnonymously(auth).catch((err) => {
      console.error("Auth Failed:", err);
    });
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user) return;
    
    // PRODUCTION PATH: 'tickets' collection
    const q = query(collection(db, 'tickets'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const t = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      t.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTickets(t);
    }, (err) => {
      console.error("Data sync error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // Handlers
  const handleGenerateTicket = async (e) => {
    e.preventDefault();
    if (!newParticipant.name || !newParticipant.email) return;

    setIsSubmitting(true);
    try {
      const ticketData = {
        name: newParticipant.name,
        email: newParticipant.email,
        type: newParticipant.type,
        status: 'ISSUED',
        createdAt: serverTimestamp(),
        issuedBy: user.uid
      };

      const docRef = await addDoc(collection(db, 'tickets'), ticketData);
      
      setNewParticipant({ name: '', email: '', type: 'Standard' });
      setSelectedTicket({ id: docRef.id, ...ticketData });

    } catch (error) {
      console.error("Creation failed", error);
      alert("Error creating ticket. Check console/permissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = () => {
    if (!selectedTicket) return;
    
    const qrPayload = JSON.stringify({ 
      id: selectedTicket.id, 
      signature: generateSignature({ id: selectedTicket.id }) 
    });
    
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`;
    
    const subject = encodeURIComponent(`Your Ticket: 2025 Global Summit`);
    const body = encodeURIComponent(
      `Hello ${selectedTicket.name},\n\nHere is your ticket.\n\nLink to QR: ${qrImageUrl}`
    );
    
    window.location.href = `mailto:${selectedTicket.email}?subject=${subject}&body=${body}`;
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerificationResult(null);

    try {
      let payload;
      try {
        payload = JSON.parse(scanInput);
      } catch (e) {
        throw new Error("Invalid QR Format");
      }

      const { id, signature } = payload;
      if (!id || !signature) throw new Error("Incomplete Ticket Data");

      const expectedSignature = generateSignature({ id });
      if (signature !== expectedSignature) throw new Error("Invalid Signature");

      const ticketRef = doc(db, 'tickets', id);
      const ticketSnap = await getDoc(ticketRef);

      if (!ticketSnap.exists()) throw new Error("Ticket ID not found");

      const ticketData = ticketSnap.data();

      if (ticketData.status === 'USED') {
        setVerificationResult({
          status: 'warning',
          message: `ALREADY USED!`,
          data: ticketData
        });
        return;
      }

      await updateDoc(ticketRef, {
        status: 'USED',
        usedAt: serverTimestamp(),
        verifiedBy: user.uid
      });

      setVerificationResult({
        status: 'success',
        message: 'Valid Ticket. Access Granted.',
        data: ticketData
      });

    } catch (err) {
      setVerificationResult({ status: 'error', message: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const totalTickets = tickets.length;
  const usedTickets = tickets.filter(t => t.status === 'USED').length;
  const revenue = totalTickets * 500;

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-emerald-400">Loading System...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg text-white">E-Cell<span className="text-emerald-500">Ticketing</span></h1>
          </div>
          
          <div className="flex bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setView('dashboard')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${view === 'dashboard' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Organizer</button>
            <button onClick={() => setView('verifier')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${view === 'verifier' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Verifier</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {view === 'dashboard' && (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              {/* Analytics */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 className="w-24 h-24 text-emerald-500" /></div>
                <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">Event Analytics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><div className="text-3xl font-bold text-white">{totalTickets}</div><div className="text-xs text-slate-500">Issued</div></div>
                  <div><div className="text-3xl font-bold text-emerald-400">{usedTickets}</div><div className="text-xs text-slate-500">Checked In</div></div>
                </div>
              </div>

              {/* Form */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Scan className="w-4 h-4 text-emerald-500" /> Issue Ticket</h3>
                <form onSubmit={handleGenerateTicket} className="space-y-4">
                  <input type="text" required value={newParticipant.name} onChange={e => setNewParticipant({...newParticipant, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Participant Name" />
                  <input type="email" required value={newParticipant.email} onChange={e => setNewParticipant({...newParticipant, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Email Address" />
                  <select value={newParticipant.type} onChange={e => setNewParticipant({...newParticipant, type: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                    <option>Standard</option><option>VIP</option><option>Speaker</option>
                  </select>
                  <button disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2">
                    {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : 'Generate Ticket'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
              <div className="p-4 border-b border-slate-800"><h3 className="font-semibold text-slate-200">Records ({tickets.length})</h3></div>
              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {tickets.map(t => (
                  <div key={t.id} onClick={() => setSelectedTicket(t)} className={`p-3 rounded-lg border cursor-pointer flex justify-between ${selectedTicket?.id === t.id ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
                    <div><div className="font-medium text-slate-200">{t.name}</div><div className="text-xs text-slate-500">{t.email}</div></div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold h-fit ${t.status === 'USED' ? 'bg-slate-800 text-slate-500' : 'bg-emerald-500/10 text-emerald-400'}`}>{t.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3">
              {selectedTicket ? (
                <div className="bg-white text-slate-900 rounded-xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-indigo-600"></div>
                  <div className="text-center mb-6"><h2 className="text-2xl font-bold">EVENT PASS</h2></div>
                  <div className="flex justify-center mb-6"><QRCodeImage data={JSON.stringify({ id: selectedTicket.id, signature: generateSignature({ id: selectedTicket.id }) })} /></div>
                  <div className="space-y-3 mb-6"><div className="border-b pb-2"><p className="text-xs text-slate-400 uppercase">Attendee</p><p className="font-bold">{selectedTicket.name}</p></div></div>
                  <button onClick={handleSendEmail} className="w-full bg-slate-900 text-white py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1"><Mail className="w-3 h-3" /> Email</button>
                </div>
              ) : (
                <div className="h-full bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-600"><p>Select a ticket</p></div>
              )}
            </div>
          </div>
        )}

        {view === 'verifier' && (
          <div className="max-w-xl mx-auto mt-10">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-indigo-400" /> Validator</h2>
              <textarea value={scanInput} onChange={(e) => setScanInput(e.target.value)} placeholder='Paste JSON payload' className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 h-24 mb-4" />
              <button onClick={handleVerify} disabled={verifying} className="bg-indigo-600 text-white px-4 py-2 rounded-md w-full">{verifying ? 'Verifying...' : 'Verify'}</button>
              
              {verificationResult && (
                <div className={`mt-4 p-4 rounded-xl border-l-4 ${verificationResult.status === 'success' ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' : 'bg-red-900/20 border-red-500 text-red-400'}`}>
                  <h3 className="font-bold">{verificationResult.status.toUpperCase()}</h3>
                  <p className="text-sm text-slate-300">{verificationResult.message}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
