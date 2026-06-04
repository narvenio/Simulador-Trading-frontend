import {apiGet, apiPOST} from "./api.js";

const priceHistory = {}
const previousPrices = {};
let portfolioChart = null;
let History_Balance_Chart = null;
let Transactions_Chart = null;
let History_asset_chart = null;
let activeUserId = null;
let vistaActual = "seccion-inicio"
const emojis = {
    "BTC": "₿",
    "ETH": "⟠",
    "SOL": "☀️",
    "DOGE": "🐕",
    "BNB": "🔶"
}

async function checkStatus(elementID, endpoint, label) {
    const element = document.getElementById(elementID);

    try{
        await apiGet(endpoint) // para que sepa a que fetch de la ruta tiene que llamar
        element.textContent = `${label}: 🟢 OK`; // muestra el parametro "label" en el frontend
    } catch (error){
        element.textContent = `${label}: 🔴 Error`;
    }
}

async function updateDashboard() {
    if (!activeUserId) return;

    await loadBalance();
    await loadPortfolio();
    await loadTransactions();
    await loadHistoryBalance();
    await loadTransactionsChart();
}

async function loadTransactions() {
    if (!activeUserId) return;
    

    try {
        const transactions = await apiGet(`/users/${activeUserId}/transactions`);

        const tableBody = document.getElementById("transactions-body");
        tableBody.innerHTML = "";

        
        
        for (const tx of transactions) {
            const asset = await apiGet(`/assets/${tx.asset_id}`);
            const row = document.createElement("tr");

            row.innerHTML = `
            <td>${tx.type}</td>
            <td>${asset.name}</td>
            <td>${tx.quantity}</td>
            <td>${tx.total_price}</td>
            <td>${new Date(tx.timestamp).toLocaleString()}</td>
            `;
// esto esta incompleto, falta el price, y la fecha en el backend
// arreglar para mañana :3
            tableBody.appendChild(row);
        };
    }catch (error) {
        console.error("Error cargando las transacciones", error);
    }
}

async function loadTransactionsChart() {
    if (!activeUserId) return
    const assetCounts = {};
    try{
        const transactions = await apiGet(`/users/${activeUserId}/transactions`);
        
        transactions.forEach(tx => {
            if (!assetCounts[tx.asset_id]){
                assetCounts[tx.asset_id] = {name: "", buys: 0, sells: 0}
            }
            if (tx.type == "BUY"){
                assetCounts[tx.asset_id].buys++;
            }else {
                assetCounts[tx.asset_id].sells++;
            }
        });

        const labels = [];
        const buyData = [];
        const sellData = [];

        for (const asset_id in assetCounts){
            const asset = await apiGet(`/assets/${asset_id}`);
            labels.push(asset.name);
            buyData.push(assetCounts[asset_id].buys);
            sellData.push(assetCounts[asset_id].sells);
        }
        renderTransactionsChart(labels, buyData, sellData);

    }catch (error){
        console.error("Error al cargar las transacciones", error);
    }
}
async function loadBalance() {
    if (!activeUserId) return;

    try {
        const data = await apiGet(`/users/${activeUserId}`);
        document.getElementById("user-balance").textContent = data.balance.toFixed(2);
    
    }catch (error) {
        console.error("Error al cargar el balance", error)
    }
}

async function CreateUser() {
    const username_input = document.getElementById("username-input"); // obtenemos el input en js
    const correo_input = document.getElementById("correo-input");
    const balance_input = document.getElementById("balance-input");

    const username = username_input.value.trim(); // cuando sea un input siempre usara .VALUE
    const correoinput = correo_input.value.trim();
    const balanceinput = balance_input.value.trim();
   
    if (!username){
        alert("Debes colocar un usuario");
        return;
    
    }
    if (!correo_input){
            alert("Debes colocar un correo");
            return;
    }
    if (!balance_input){
        alert("Debes colocar un Saldo");
        return;
    }
   

    try {
        const response = await apiPOST("/users", {
    
         name : username,
         email: correoinput,
         balance: balanceinput

         
    });

    if (response.detail){
        alert(response.detail);
        return;
    }

    activeUserId = response.id; // aqui guardas el id del usuario
    localStorage.setItem("activeuserId", activeUserId);
    let active_user = document.getElementById("usuario_activo").classList.remove("d-none");
   
    document.getElementById("active-usernames").textContent = username// cambias el span para mostrar el usuario que has creado
    document.getElementById("correo-input").textContent = response.email;
    document.getElementById("user-balance").textContent = parseFloat(data.balance).toFixed(2)+" $"; // cambias por el balance del usuario y si no tiene pues pones 0
    

    username_input.value = "";
    correo_input.value = "";
    balance_input.value = "";

    await updateDashboard();
} catch (error) {
    console.error("Error Completo:", error);
    alert("Error Creando al Usuario:" + error.message)
}}
document.getElementById("button-create-user").addEventListener("click", CreateUser) // obtienes el boton de html y añades un evento que al clickear activas la funcion CreateUser

async function restoreUser(){
    const savedataUser = localStorage.getItem("activeuserId");

    if (savedataUser){
        activeUserId = savedataUser;
        const data = await apiGet(`/users/${savedataUser}`)

        document.getElementById("usuario_activo").classList.remove("d-none");
        document.getElementById("active-usernames").textContent = data.name;
        //document.getElementById("user-correo").textContent = data.email;
        document.getElementById("user-balance").textContent = parseFloat(data.balance).toFixed(2)+" $";
        
        await updateDashboard();
    }

    

}

async function handleTransaction(type, asset_id, quantity) {
    if (!activeUserId) {
        alert("Usuario no activo");
        return;
    }

    if (!quantity|| quantity <= 0) {
        alert("Cantidad invalida");
        return;
    }

    try {
        const response = await apiPOST(`/${type}`, {
            user_id: activeUserId,
            asset_id: asset_id,
            quantity: quantity
        });

        if (response.detail){
            alert(response.detail);
            return;
        }

        await loadPortfolio();
        await loadBalance();
        await loadHistoryBalance();
    } catch (error) {
        console.error(error);
    }
}

async function loadMarket() {
    const marketDiv = document.getElementById("Market-list");
    const selector = document.getElementById("asset-selector");
    selector.innerHTML = "";
    try{
        const data = await apiGet("/market");
        marketDiv.innerHTML = "";

        data.market.forEach(asset => {
          const symbolKey = asset.symbol;
          const prev_price = previousPrices[symbolKey];
          const currentPrice = asset.simulated_price;
          let percentText = ""; // texto para los porcentajes
          let priceClass = "price-same" // para identificar cuando subio o bajo
          
            if (prev_price === undefined) {
                priceClass = "price-same"; // prev_price no existe? entonces es "price-same"
            }
            if (currentPrice > prev_price) { // si no lo es y existe, entonces si el precio actual es mayor al anterior = "price_up"
               priceClass= "price-up";
            }
            else if (currentPrice < prev_price) {// si no lo es entonces, si el precio actual es menor al anteior = "price-down" 
                priceClass = "price-down";
            }

            if (prev_price !== undefined){
                const percentChange = ((currentPrice - prev_price) / prev_price) * 100;
                percentText = `(${percentChange.toFixed(2)}%)`;
            }
        const option = document.createElement("option");
        option.value = asset.symbol;
        option.textContent = asset.name;
        selector.appendChild(option);
            previousPrices[symbolKey] = currentPrice;
            updatePriceHistory(symbolKey, currentPrice, prev_price);
            updateNavbarPrice(symbolKey, currentPrice, prev_price, percentText);
            renderMarketItem(asset,percentText, priceClass);
        })
        
        const selectedSymbol = document.getElementById("asset-selector");
        const simboloAMostrar = selectedSymbol.value || data.market[0]?.symbol;

        selectedSymbol.value = simboloAMostrar;
        renderMarketChart(simboloAMostrar);
       

    }catch (error){
        marketDiv.innerHTML = "Nose pudo Cargar el Mercado";
    }
}

function updatePriceHistory(symbolKey, currentPrice, prev_price) {
     
    const open = prev_price || currentPrice;
    const close = currentPrice;
    const high = Math.max(open, close) * 1.002;
    const low  = Math.min(open, close) * 0.998;
    if (!priceHistory[symbolKey]){
                priceHistory[symbolKey] = [];
            }

            priceHistory[symbolKey].push({
                time: Math.floor(Date.now() / 500),
                open: open,
                high: high,
                low: low,
                close: close
            });
            //console.log("priceHistory actualizado:", priceHistory)

}

function updateNavbarPrice(symbolKey, currentPrice, prev_price, percentText){

    const selectedSymbol = document.getElementById("asset-selector").value
    const percentSpan = document.getElementById("asset-porcentage");
   
    
     if (symbolKey === selectedSymbol){
                percentSpan.textContent = `${percentText}`;
                if (currentPrice > prev_price){
                    percentSpan.className = "text-success";
                    
                }
                if (currentPrice < prev_price){
                    percentSpan.className = "text-danger";
                }
                percentSpan.textContent = currentPrice > prev_price ? `+${percentText}` : `${percentText}`;
                document.getElementById("asset-current-price").textContent = `$${currentPrice.toFixed(2)}`;
                    document.getElementById("asset-symbol").textContent = `${symbolKey}/USD`;
                
        }
    
   
}

function renderMarketItem(asset, percentText, priceClass){
    const marketDiv = document.getElementById("Market-list");

    // Crear contenedor principal (tarjeta exterior)
    const card = document.createElement("div");
    card.className = "card bg-dark border-secondary shadow-sm text-white";
    card.style.width = "18rem";

    // cuerpo de la tarjeta
    const cardBody = document.createElement("div");
    cardBody.className = "card-body";

    // encabezado // div
    const headerContainer = document.createElement("div"); //contenedor div
    headerContainer.className = "d-flex justify-content-between align-items-center mb-3";

    const brandContainer = document.createElement("div");
    brandContainer.className = "d-flex align-items-center gap-3";

    const logoCircle = document.createElement("div");
    logoCircle.className = "rounded-circle bg-secondary d-flex justify-content-center align-items-center fs-4";
    logoCircle.style.width = "45px";
    logoCircle.style.height = "45px";

    // obtener simbolos y pasarlos como argumento en lista emojis
    const symbol = asset.symbol || "BTC";
    logoCircle.textContent = emojis[symbol] || "🪙";


    // nombres y simbolos
    const titleDiv = document.createElement("div");


    // titulo del asset
    const title = document.createElement("h5");
    title.className = "card-title mb-0 font-weight-bold";
    title.textContent = asset.asset_name;

    const subtitle = document.createElement("small");
    subtitle.className = "text-light opacity-75";
    subtitle.textContent = symbol; 

    titleDiv.append(title, subtitle)
    brandContainer.append(logoCircle, titleDiv);

    const percentage = document.createElement("span");
    percentage.className = `badge ${priceClass === 'price-up' ? 'bg-success' : 'bg-danger'}`;
    percentage.textContent = percentText;

    headerContainer.append(brandContainer, percentage);
    

    // precio actual
    const priceElement = document.createElement("h3");
    priceElement.className = "card-text text-light mb-4";
    priceElement.textContent = `$${parseFloat(asset.simulated_price || 0).toFixed(2)}`

    //input de cantidad
    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.className = "form-control bg-secondary text-white border-dark mb-4";
    amountInput.placeholder = "Cantidad a Operar";
    amountInput.min = 0;

    // botones 
    const Buybtn = document.createElement("button");
    Buybtn.textContent = "Comprar";
    Buybtn.type = "button";
    Buybtn.className = "btn btn-success w-100 mb-2";

    const Sellbtn = document.createElement("button");
    Sellbtn.textContent = "Vender";
    Sellbtn.type = "button";
    Sellbtn.className = "btn btn-danger w-100";

    Buybtn.addEventListener("click", (event) => {
        event.preventDefault();
        handleTransaction("buy", asset.asset_id, parseFloat(amountInput.value));
    });

    Sellbtn.addEventListener("click", (event) => {
        event.preventDefault();
        handleTransaction("sell", asset.asset_id, parseFloat(amountInput.value));
    });

    // guardamos dentro del cuerpo de la tarjeta
    cardBody.appendChild(headerContainer);
    cardBody.appendChild(priceElement);
    cardBody.appendChild(amountInput);
    cardBody.appendChild(Buybtn);
    cardBody.appendChild(Sellbtn);

    card.appendChild(cardBody);
    marketDiv.appendChild(card);


}
/* 
function renderMarketItem(asset, percentText, priceClass){
    const marketDiv = document.getElementById("Market-list");
    const item = document.createElement("div");
    item.className = "market-item";
    const pricesymbol = priceClass === "price-up" ? "↑" : priceClass === "price-down" ? "↓" : "";
 

    const Buybtn = document.createElement("button"); // creamos botones comprar y vender
    Buybtn.textContent = "Comprar";
    Buybtn.type = "button";

    const Sellbtn = document.createElement("button");
    Sellbtn.textContent = "Vender";
    Sellbtn.type = "button";

    const amountInput = document.createElement("input"); // creamos un input individiual para cada asset
    amountInput.type = "number";
    amountInput.placeholder = "Cantidad";
    amountInput.min = "0";

    Buybtn.addEventListener("click",  async (event) => {
        event.preventDefault();
        handleTransaction("buy", asset.asset_id, parseFloat(amountInput.value))
        
    });

    Sellbtn.addEventListener("click", async(event) => {
        event.preventDefault();
        handleTransaction("sell", asset.asset_id, parseFloat(amountInput.value))
    }); 

/* creamos un elemento option, le asignamos el valor del symbolo del asset y
y que muestre el nombre del asset, y que luego se agrega la opcion en el selector*/
/*
    const emoji = emojis[asset.symbol] || "💰"; 
    const title = document.createElement("strong"); //son etiquetas que estas creando con DOM
    title.textContent = `${emoji} ${asset.name}`;
            

    const symbol = document.createElement("span");
    symbol.textContent = ` (${asset.symbol})`;

    const precio = document.createElement("p")
    precio.textContent = `Precio: ${asset.simulated_price} ${pricesymbol} ${percentText}`;
    precio.className = priceClass;
// priceClass es la clase del parrafo porque servira para modificarlo en css

    item.append(title, symbol, precio, amountInput, Buybtn, Sellbtn);
    console.log("Creando item para:", asset.name, "botones:", Buybtn, Sellbtn);   
    marketDiv.appendChild(item);
       
}*/


/*async function loadMarket() {
    const marketDiv = document.getElementById("Market-list");
    const selector  = document.getElementById("asset-selector");
    selector.innerHTML = "";
    try {
        const data = await apiGet("/market") // variable que haga el fetch a la funcion con la ruta "/market"
        marketDiv.innerHTML = ""; // limpiamos el div, para que al mostrar algo no hay problema

        data.market.forEach(asset=> { // esto es un for normal, solo que "asset" es la variable temporal y data.market entras directamente
            const item = document.createElement("div"); // creas div con DOM y luego le pones una clase
            item.className = "market-item";

            const Buybtn = document.createElement("button"); // creamos botones comprar y vender
            Buybtn.textContent = "Comprar";

            const Sellbtn = document.createElement("button");
            Sellbtn.textContent = "Vender";

            const amountInput = document.createElement("input"); // creamos un input individiual para cada asset
            amountInput.type = "number";
            amountInput.placeholder = "Cantidad";
            amountInput.min = "0";

            Buybtn.addEventListener("click", () => {
                handleTransaction("buy", asset.asset_id, parseFloat(amountInput.value))
            });

            Sellbtn.addEventListener("click", () => {
                handleTransaction("sell", asset.asset_id, parseFloat(amountInput.value))
            });

            const option = document.createElement("option");
            option.value = asset.symbol;
            option.textContent = asset.name;
            selector.appendChild(option);
 creamos un elemento option, le asignamos el valor del symbolo del asset y
y que muestre el nombre del asset, y que luego se agrega la opcion en el selector
            const symbolKey = asset.symbol;
            const currentPrice = asset.simulated_price;
            const prev_price = previousPrices[symbolKey] // variable que busca dentro del objeto el symbolo del asset
            const percentSpan = document.getElementById("asset-porcentage");
            let percentText = ""; // texto para los porcentajes
            
            let priceClass = "price-same" 
            

           
            const selectedSymbol = document.getElementById("asset-selector").value;
          
           
            if (prev_price === undefined) {
                priceClass = "price-same"; // prev_price no existe? entonces es "price-same"
            }
            if (currentPrice > prev_price) { // si no lo es y existe, entonces si el precio actual es mayor al anterior = "price_up"
                percentSpan.className = "text-success";
            }
            else if (currentPrice < prev_price) {              // si no lo es entonces, si el precio actual es menor al anteior = "price-down" 
                percentSpan.className = "text-danger";
            }
              
            
            previousPrices[symbolKey] = currentPrice;

            let pricesymbol = 
            priceClass === "price-up" ? "↑": // creas variable si sube = ↑
            priceClass === "price-down" ? "↓": ""; // sino ↓ y sino esta vacio

            
            if (prev_price !== undefined){
                const percentChange = ((currentPrice - prev_price) / prev_price) * 100
                percentText = `(${percentChange.toFixed(2)}%)`;
            }

            if (symbolKey === selectedSymbol){
                percentSpan.textContent = `${percentText}`;
                percentSpan.className = currentPrice > prev_price ? "text-success" : "text-danger";
                document.getElementById("asset-current-price").textContent = `$${currentPrice.toFixed(2)}`;
                document.getElementById("asset-symbol").textContent = `${symbolKey}/USD`;
            }
            const emoji = emojis[asset.symbol] || "💰"; 
            const title = document.createElement("strong"); //son etiquetas que estas creando con DOM
            title.textContent = `${emoji} ${asset.name}`;
            

            const symbol = document.createElement("span");
            symbol.textContent = ` (${asset.symbol})`;

            const precio = document.createElement("p")
            precio.textContent = `Precio: ${asset.simulated_price} ${pricesymbol} ${percentText}`;
            precio.className = priceClass;
// priceClass es la clase del parrafo porque servira para modificarlo en css

            item.append(title, symbol, precio, amountInput, Buybtn, Sellbtn);
            console.log("Creando item para:", asset.name, "botones:", Buybtn, Sellbtn);   
            marketDiv.appendChild(item);

            
            if (selectedSymbol && History_asset_chart){
                renderMarketChart(selectedSymbol);
            }
        });
    } catch (error) {
        marketDiv.innerHTML = "No se pudo cargar el Mercado";
    } 
}
*/
async function loadHistoryBalance() {
    if (!activeUserId) return;
    const labels = [];
    const values = [];
    
    try{
        const data = await apiGet(`/users/${activeUserId}/balance-history`)
        
        data.forEach(datos => {
            labels.push(new Date(datos.timestamp).toLocaleString());
            values.push(datos.balance);

        });
        renderBalanceChart(labels, values);
    }
    catch (error){
        console.error(`Error Completo: ${error}`);
        //alert(`Error al cargar el balance historico`);
    }
}
document.addEventListener("DOMContentLoaded", () => {

    const botonesTema = document.querySelectorAll(".btn-tema");
    const html = document.documentElement; // creas una raiz de html <html></html>

    const aplicarTema= (tema) => {
        html.setAttribute("data-bs-theme", tema);

        //texto que se pondra dependiendo del tema
        const icono = tema === "dark" ? "☀️" : "🌙";
        const textoEscritorio = tema == "dark" ? "☀️ Modo Claro" : "🌙 Modo Oscuro";

        botonesTema.forEach(boton => {
            if (boton.classList.contains("btn-link")){
                boton.textContent = icono;
            } else {
                boton.textContent = textoEscritorio;
            }
        });
        localStorage.setItem("temaSimulator", tema);
    };
    aplicarTema(localStorage.getItem("temaSimulator") || "dark");
    
    botonesTema.forEach(boton => {
        boton.addEventListener("click", () => {
            const esOscuro = html.getAttribute("data-bs-theme") === "dark";
            aplicarTema(esOscuro ? "light" : "dark");
        });
    });

    loadMarket();
    setInterval(loadMarket, 5000);

    restoreUser(); // usamos => porque tenemos que cargar varias funciones.

    document.getElementById("asset-selector").addEventListener("change", (e) => {
        renderMarketChart(e.target.value);
    });
} );

function renderMarketChart(symbol){

    if (History_asset_chart){
        History_asset_chart.remove();
    }
    const container = document.getElementById("market-chart");
    const chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 300,
        layout: {
            background: {color: `#000000`},
            textColor: "#ffffff"
        },
        grid: {
            vertLines: {color: `#1a1a1a`},
            horzLines: {color : `#1a1a1a`}
        }
    });
    chart.timeScale().applyOptions({
        rightOffset: 20,
        barSpacing: 6,
    });
    const lineSeries = chart.addCandlestickSeries();
    lineSeries.setData(priceHistory[symbol]);
    History_asset_chart = chart;
    //console.log("Symbol:", symbol);
    //console.log("Datos:", priceHistory[symbol]);
    
};

async function renderBalanceChart(labels, values) {
    const ctx = document.getElementById("history_balance_chart").getContext("2d");

    if (History_Balance_Chart) {
        History_Balance_Chart.destroy();
    }

    History_Balance_Chart = new Chart(ctx, {
        type: "line",
        data: {
            
            labels: labels,
            datasets: [{
                label: "Balance",
                data: values}]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

async function renderPortfolioChart(labels, values) {
    const ctx = document.getElementById("portfolio_chart").getContext("2d");

    if (portfolioChart){
        portfolioChart.destroy();
    }

    portfolioChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{data: values}]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

async function renderTransactionsChart(labels, buyData, sellData) {
    const ctx = document.getElementById("transactions_chart").getContext("2d");

    if (Transactions_Chart){
        Transactions_Chart.destroy();
    }

    const misOpciones = {
        responsive : true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    };

    Transactions_Chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{label: "Compras", data: buyData, backgroundColor: 'green'},
                       {label: "Ventas", data: sellData, backgroundColor: 'red'}
            ]
        },
        options: misOpciones
    });

}

// async function CreateUser() {
//     const usernameInput = document.getElementById("username-input"); // obtenemos el input en js
//     const username_correo_input = document.getElementById("username_email-input");
//     const username_balance_input = document.getElementById("username_balance-input");

//     const username = usernameInput.value.trim(); // cuando sea un input siempre usara .VALUE
//     const username_correo = username_correo_input.value.trim();
//     const username_balance = username_balance_input.value.trim();
   
//     if (!username){
//         alert("Debes colocar un usuario");
//         return;
    
//     }
//     if (!username_correo){
//             alert("Debes colocar un correo");
//             return;
//     }
//     if (!username_balance){
//         alert("Debes colocar un Saldo");
//         return;
//     }
   

//     try {
//         const response = await apiPOST("/users", {
    
//          name : username,
//          email: username_correo,
//          balance: username_balance

         
//     });

//     if (response.detail){
//         alert(response.detail);
//         return;
//     }

//     activeUserId = response.id; // aqui guardas el id del usuario
//     localStorage.setItem("activeuserId", activeUserId);
//     document.getElementById("active-username").textContent = username; // cambias el span para mostrar el usuario que has creado
//     document.getElementById("user-correo").textContent = response.email;
//     document.getElementById("user-balance").textContent = response.balance.toFixed(2); // cambias por el balance del usuario y si no tiene pues pones 0

//     usernameInput.value = "";
//     username_correo_input.value = "";
//     username_balance_input.value = "";

//     await updateDashboard();
// } catch (error) {
//     console.error("Error Completo:", error);
//     alert("Error Creando al Usuario:" + error.message)
// }}
// document.getElementById("create-user-btn").addEventListener("click", CreateUser) // obtienes el boton de html y añades un evento que al clickear activas la funcion CreateUser





function limpiar(){
    const username = document.getElementById("username-input");
    const correo = document.getElementById("correo-input");
    const balance = document.getElementById("balance-input");

    username.value = "";
    correo.value = "";
    balance.value = "";
}
document.getElementById("limpiar").addEventListener("click", limpiar)

async function loadPortfolio() {
    
    const labels = [];
    const values = [];
    if (!activeUserId) return; // si no hay id con el return FRENAS el codigo, es como un freno de MANO

    const portfolioDiv = document.getElementById("portfolio-list");

    try {
        const data = await apiGet(`/portafolio/${activeUserId}`);
        
        portfolioDiv.innerHTML = "";

        data.forEach(asset => {

            const item = document.createElement("div");
            item.className = "portfolio-item";

            const name = document.createElement("strong");
            name.textContent = asset.asset_name;

            const quantity = document.createElement("p");
            quantity.textContent = `Cantidad: ${asset.quantity}`;

            item.append(name, quantity);
            portfolioDiv.appendChild(item);

            labels.push(asset.asset_name);
            values.push(asset.total_value);

            
        });

        renderPortfolioChart(labels, values);
    } catch (error){
        portfolioDiv.textContent = "Error cargando portafolio";
    }
}

function cambiarSeccion(nuevaVista){
    if (vistaActual == nuevaVista) return;

    document.getElementById(vistaActual).classList.replace("d-block", "d-none");
    document.getElementById(nuevaVista).classList.replace("d-none", "d-block");

    vistaActual = nuevaVista;

    if (vistaActual == "seccion-portfolio"){
        refrescarGraficas();
    }

}

document.getElementById("btn-inicio").addEventListener("click", (event) => {
    event.preventDefault();
    cambiarSeccion("seccion-inicio");
})

document.getElementById("btn-comprar").addEventListener("click", (event) => {
    event.preventDefault();
    cambiarSeccion("seccion-comprar");
})

document.getElementById("btn-portfolio").addEventListener("click", (event) => {
    event.preventDefault();
    cambiarSeccion("seccion-portfolio");
})

function refrescarGraficas(){
    portfolioChart?.update();
    History_Balance_Chart?.update();
    Transactions_Chart.update();
    
}

