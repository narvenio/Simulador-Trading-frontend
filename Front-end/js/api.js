// funcion generica para la api
const API_URL = "http://127.0.0.1:8000";

export async function apiGet(endpoint) {
    const res = await fetch(`${API_URL}${endpoint}`);
    return res.json();
}
// con la funcion asincronica espera una respuesta para funcionar
// luego con la variable utiliza await, hace una peticion a la url
// y usa el parametro que antes dijimos

export async function apiPOST(endpoint, data) {
    const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });   
    return res.json();   
}
    
// haces la funcion para llamar api y añades su configuracion
// metodo: POST, headers es el tipo de formato y luego conviertes el archivo json a texto
