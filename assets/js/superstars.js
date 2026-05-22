const TIME_SERIES = [{"name": "Samsung", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 3.5, 4.0, 3.5, 0.0, 4.0, 1.5, 2.0, 1.0, 5.0, 3.0, 7.5, 5.0, 2.0, 13.0, 10.0, 12.0, 16.5, 23.0, 47.5, 38.0, 7.0]}, {"name": "Siemens", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [1.0, 1.5, 0.0, 2.0, 2.0, 3.0, 1.0, 0.0, 6.0, 5.0, 2.0, 5.0, 11.0, 14.0, 5.0, 3.0, 5.0, 2.0, 0.0, 0.0, 2.0, 1.0, 1.0, 2.0, 2.0, 2.0, 2.0, 4.0, 5.0, 11.333, 35.0, 13.0, 34.25, 20.5]}, {"name": "Fujitsu", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [3.0, 2.0, 2.0, 5.0, 1.0, 0.0, 2.0, 2.0, 2.0, 1.0, 0.0, 0.5, 0.0, 3.0, 1.0, 0.5, 2.0, 0.0, 1.0, 0.0, 1.0, 0.0, 4.0, 2.0, 5.5, 5.0, 4.0, 7.0, 15.0, 4.0, 10.0, 19.0, 26.0, 40.333]}, {"name": "Google", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 3.0, 0.0, 1.0, 0.0, 0.0, 3.0, 1.0, 4.0, 11.0, 11.0, 16.0, 17.0, 27.0, 27.0]}, {"name": "Microsoft", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 2.0, 1.0, 1.0, 5.0, 5.0, 15.0, 23.0, 29.0, 16.0, 11.0, 13.0, 10.0, 10.0, 6.0, 2.0, 5.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]}, {"name": "IBM", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [7.5, 17.0, 15.0, 13.5, 14.0, 3.0, 4.5, 2.0, 1.0, 3.0, 6.0, 5.0, 5.0, 5.0, 4.0, 4.0, 3.5, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 4.0, 0.0]}, {"name": "Bosch", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 2.0, 1.0, 1.0, 1.0, 0.0, 4.0, 3.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 18.0, 31.0, 14.0, 9.0]}, {"name": "Tata Consultancy", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2.0, 1.0, 1.0, 3.0, 3.0, 6.0, 3.0, 11.0, 13.0, 12.5, 17.0]}, {"name": "Huawei", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 2.0, 1.0, 1.0, 0.0, 1.0, 4.0, 4.0, 1.0, 1.5, 5.0, 6.0, 8.0, 14.5, 12.5, 28.0]}, {"name": "Intel", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 2.0, 5.0, 0.0, 1.0, 2.0, 1.0, 0.0, 22.0, 3.0, 18.0, 7.0, 16.0, 13.0]}, {"name": "Sony", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [2.0, 1.0, 6.0, 2.0, 1.0, 1.0, 3.0, 3.0, 2.5, 4.0, 3.5, 6.0, 0.0, 1.0, 0.0, 3.5, 6.0, 9.0, 6.0, 5.0, 4.0, 6.0, 3.0, 0.0, 3.0, 3.0, 0.0, 2.0, 1.0, 17.5, 8.0, 1.0, 0.0, 0.0]}, {"name": "Toshiba", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [3.0, 6.0, 5.0, 5.5, 1.0, 2.0, 3.0, 1.0, 1.0, 1.0, 0.0, 4.0, 1.0, 2.0, 0.0, 2.0, 2.0, 7.0, 1.5, 5.0, 3.0, 10.0, 0.0, 0.0, 1.5, 2.5, 1.0, 1.0, 4.0, 1.0, 0.0, 1.0, 1.0, 1.0]}, {"name": "Xerox", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [0.0, 2.0, 0.0, 5.0, 2.0, 3.0, 2.0, 4.0, 1.0, 11.0, 3.0, 2.0, 2.0, 9.0, 1.0, 7.0, 9.0, 7.0, 2.0, 0.0, 7.0, 5.0, 0.0, 6.0, 4.0, 4.0, 6.0, 7.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]}, {"name": "AT&T", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [3.0, 2.0, 4.0, 8.0, 12.0, 7.0, 9.0, 5.0, 6.0, 2.0, 1.0, 1.0, 7.0, 3.0, 3.0, 2.2, 7.0, 7.0, 9.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]}, {"name": "NEC", "years": [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], "equiv": [4.0, 1.0, 0.0, 1.0, 1.0, 3.0, 6.0, 8.0, 6.0, 4.0, 2.0, 3.0, 2.0, 1.0, 1.2, 3.0, 0.0, 2.0, 1.0, 6.0, 2.0, 1.0, 2.0, 2.0, 3.0, 2.0, 1.0, 2.0, 0.5, 0.0, 2.0, 7.0, 4.0, 0.0]}];

const SD = {
  applicants: [
    {name:"Microsoft Corporation",equiv:48.0,patents:48,papers:33},
    {name:"IBM",equiv:47.5,patents:48,papers:36},
    {name:"Xerox Corporation",equiv:39.0,patents:39,papers:24},
    {name:"Sony Corporation",equiv:34.0,patents:36,papers:27},
    {name:"NEC Corporation",equiv:31.2,patents:32,papers:29},
    {name:"Siemens",equiv:29.0,patents:29,papers:27},
    {name:"AT&T Corp.",equiv:27.2,patents:28,papers:24},
    {name:"Canon",equiv:25.0,patents:25,papers:21},
    {name:"Matsushita Electric",equiv:24.5,patents:25,papers:24},
    {name:"Samsung Electronics",equiv:24.0,patents:25,papers:27},
    {name:"Toshiba",equiv:21.5,patents:22,papers:17},
    {name:"Fujitsu",equiv:20.0,patents:20,papers:18},
    {name:"Philips Electronics",equiv:17.0,patents:26,papers:23},
    {name:"Motorola",equiv:14.0,patents:14,papers:14},
    {name:"Sharp",equiv:13.0,patents:14,papers:13},
    {name:"Hitachi",equiv:13.0,patents:14,papers:13},
    {name:"Alcatel Lucent",equiv:13.0,patents:13,papers:12},
    {name:"Mitsubishi Electric",equiv:12.5,patents:18,papers:8},
    {name:"British Telecom",equiv:12.0,patents:12,papers:9},
    {name:"Sony International Europe",equiv:11.5,patents:12,papers:11},
    {name:"Hewlett-Packard",equiv:11.0,patents:11,papers:10},
    {name:"Thomson Licensing",equiv:10.5,patents:11,papers:8},
    {name:"Pioneer Corporation",equiv:10.0,patents:10,papers:9},
    {name:"Microsoft Technology Licensing",equiv:10.0,patents:10,papers:8},
    {name:"Siemens Healthcare",equiv:9.0,patents:9,papers:9},
    {name:"Nuance Communications",equiv:9.0,patents:9,papers:8},
    {name:"Alibaba Group",equiv:9.0,patents:9,papers:6},
    {name:"Broadcom",equiv:9.0,patents:9,papers:4},
    {name:"Intel",equiv:8.0,patents:8,papers:8},
    {name:"Google",equiv:8.0,patents:8,papers:6}
  ],
  inventors: [
    {name:"Bober, Miroslaw",equiv:6.5,patents:10},
    {name:"Kawazoe, Yoshihiro",equiv:3.0,patents:4},
    {name:"Gréhant, Xavier",equiv:3.0,patents:3},
    {name:"Van Schaack, Andrew",equiv:2.5,patents:5},
    {name:"Paschalakis, Stavros",equiv:2.5,patents:5},
    {name:"Ganong, William F. III",equiv:2.5,patents:4},
    {name:"Larvet, Philippe",equiv:2.5,patents:3},
    {name:"Herbig, Tobias",equiv:2.3,patents:5},
    {name:"Lewis, Andrew Smith",equiv:2.0,patents:4},
    {name:"Hain, Horst-Udo",equiv:2.0,patents:2},
    {name:"Mitchell, Don",equiv:2.0,patents:2},
    {name:"Elworthy, David",equiv:2.0,patents:2},
    {name:"Saeki, Takanori",equiv:2.0,patents:2},
    {name:"Brand, Matthew",equiv:2.0,patents:2},
    {name:"Marmor, Eliyahu",equiv:2.0,patents:2},
    {name:"Starkie, Bradford Craig",equiv:2.0,patents:2},
    {name:"Agnarsson, Snorri",equiv:2.0,patents:2},
    {name:"Wang, Kuansan",equiv:2.0,patents:2},
    {name:"Moore, Robert C.",equiv:2.0,patents:2},
    {name:"Klakow, Dietrich",equiv:2.0,patents:2},
    {name:"Wrobel, Stefan",equiv:2.0,patents:2},
    {name:"Singh, Amit P.",equiv:2.0,patents:2},
    {name:"Zelenko, Dmitry",equiv:2.0,patents:2},
    {name:"Fujimaki, Ryohei",equiv:2.0,patents:2},
    {name:"Shinoda, Koichi",equiv:2.0,patents:2}
  ],
  papers: [
    {title:"Data clustering: a review",year:1999,topic:"Clustering",citing_patents:25,applicants:23,share:1.538,cited_by:13005},
    {title:"Self-Organizing Maps",year:1995,topic:"Neural Networks",citing_patents:16,applicants:19,share:0.985,cited_by:10377},
    {title:"A self correcting clock recovery circuit",year:1985,topic:"Neural Networks",citing_patents:12,applicants:9,share:0.738,cited_by:134},
    {title:"Random Forests",year:2001,topic:"Neural Networks",citing_patents:12,applicants:8,share:0.738,cited_by:118167},
    {title:"The self-organizing map",year:1990,topic:"Neural Networks",citing_patents:10,applicants:8,share:0.615,cited_by:8062},
    {title:"Uniform Resource Identifier (URI): Generic Syntax",year:2005,topic:"NLP",citing_patents:9,applicants:5,share:0.554,cited_by:789},
    {title:"Probabilistic boosting-tree: learning discriminative models",year:2005,topic:"Machine Learning",citing_patents:8,applicants:7,share:0.492,cited_by:392},
    {title:"Multi-modal interaction in the age of information appliances",year:2002,topic:"Speech",citing_patents:8,applicants:6,share:0.492,cited_by:12},
    {title:"Scatter/Gather: cluster-based approach to browsing large document collections",year:1992,topic:"Text Analysis",citing_patents:8,applicants:5,share:0.492,cited_by:945},
    {title:"Induction of decision trees",year:1986,topic:"AI Problem Solving",citing_patents:8,applicants:4,share:0.492,cited_by:12290},
    {title:"An introduction to computing with neural nets",year:1988,topic:"Neural Networks",citing_patents:7,applicants:6,share:0.431,cited_by:528},
    {title:"Speaker Verification Using Adapted Gaussian Mixture Models",year:2000,topic:"Speech Recognition",citing_patents:7,applicants:6,share:0.431,cited_by:4245},
    {title:"Maximum likelihood linear regression for speaker adaptation",year:1995,topic:"Speech Recognition",citing_patents:7,applicants:5,share:0.431,cited_by:2205},
    {title:"Learning the parts of objects by non-negative matrix factorization",year:1999,topic:"Neural Networks",citing_patents:7,applicants:4,share:0.431,cited_by:13745},
    {title:"Surfing the Web by voice",year:1995,topic:"Speech",citing_patents:7,applicants:3,share:0.431,cited_by:39},
    {title:"A feature-based algorithm for detecting and classifying scene breaks",year:1995,topic:"Anomaly Detection",citing_patents:7,applicants:2,share:0.431,cited_by:491},
    {title:"Basic principles of ROC analysis",year:1978,topic:"Classification",citing_patents:6,applicants:7,share:0.369,cited_by:5999},
    {title:"Machine learning in automated text categorization",year:2002,topic:"Text Classification",citing_patents:6,applicants:5,share:0.369,cited_by:7829},
    {title:"Estimating the Support of a High-Dimensional Distribution",year:2001,topic:"Machine Learning",citing_patents:6,applicants:5,share:0.369,cited_by:5738},
    {title:"Speaker recognition: a tutorial",year:1997,topic:"Speech Recognition",citing_patents:6,applicants:5,share:0.369,cited_by:1627},
    {title:"Learning representations by back-propagating errors",year:1986,topic:"Neural Networks",citing_patents:6,applicants:5,share:0.369,cited_by:29489},
    {title:"Long Short-Term Memory",year:1997,topic:"Neural Networks",citing_patents:6,applicants:4,share:0.369,cited_by:92846},
    {title:"Speaker background models for connected digit password speaker verification",year:2002,topic:"Speech Recognition",citing_patents:7,applicants:4,share:0.431,cited_by:98},
    {title:"Machine learning in automated text categorization (review)",year:2002,topic:"Text Classification",citing_patents:6,applicants:5,share:0.369,cited_by:7829},
    {title:"PADIS – An automatic telephone switchboard and directory information system",year:1997,topic:"Speech",citing_patents:6,applicants:4,share:0.369,cited_by:27}
  ]
};

function showSS(id, btn) {
  document.querySelectorAll('.ss-main .section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ss-nav .nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}

const P_SS = {
  blue:  '#104e8b',
  blue2: '#6ea8d4',
  teal:  '#1a7a6a',
  multi: ['#104e8b','#c4622d','#1a7a6a','#7a4f9c','#3a8ec1','#d4904a','#2b6e50','#9b5068','#5a6e85','#8c9c40','#5b4a9c','#c94864','#3d7a6a','#7a5a28','#4a6ca8'],
};

const cfg = {responsive:true, displayModeBar:false};
const L = (extra) => Object.assign({
  margin:{l:200,r:40,t:10,b:40},
  paper_bgcolor:'#fff', plot_bgcolor:'#fff',
  font:{family:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',size:12,color:'#374151'},
  xaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false},
  yaxis:{showgrid:false,zeroline:false,automargin:true},
}, extra||{});

// KPIs
const _ssico = (p) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const _sskpi = (icon, val, lbl) => `<div class="ss-kpi"><div class="kpi-icon">${_ssico(icon)}</div><div class="kpi-content"><div class="val">${val}</div><div class="lbl">${lbl}</div></div></div>`;
document.getElementById('ss-kpis').innerHTML =
  _sskpi('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
    `${SD.applicants.length}+`, 'Déposants<br>actifs en IA') +
  _sskpi('<circle cx="12" cy="8" r="7"/><polyline points="8.21,13.89 7,23 12,20 17,23 15.79,13.88"/>',
    SD.applicants[0].name.split(' ').slice(0,1).join(' '), `N°1 déposant<br>${SD.applicants[0].patents} brevets IA`) +
  _sskpi('<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    SD.inventors[0].name.split(',')[0], `N°1 inventeur<br>${SD.inventors[0].patents} brevets IA`) +
  _sskpi('<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"/>',
    `${SD.papers.length}+`, 'Publications<br>superstar identifiées');

// Chart: Applicants
const appNames = SD.applicants.slice(0,25).map(d=>d.name).reverse();
const appEquiv = SD.applicants.slice(0,25).map(d=>d.equiv).reverse();
const appPatents = SD.applicants.slice(0,25).map(d=>d.patents).reverse();

Plotly.newPlot('ch-applicants', [
  {x:appEquiv, y:appNames, type:'bar', orientation:'h', name:'Brevets IA (équivalent fractionné)',
   marker:{color:P_SS.blue,opacity:.88},
   hovertemplate:'<b>%{y}</b><br>Équiv. fractionné: %{x}<extra></extra>'},
  {x:appPatents, y:appNames, type:'bar', orientation:'h', name:'Brevets IA (total brut)',
   marker:{color:P_SS.blue2,opacity:.7},
   hovertemplate:'<b>%{y}</b><br>Total brevets: %{x}<extra></extra>'}
], L({barmode:'overlay', legend:{orientation:'h',y:-0.08,x:0.5,xanchor:'center'},
     xaxis:{title:'Nombre de brevets IA',showgrid:true,gridcolor:'#f3f4f6',zeroline:false}}), cfg);

// Chart: Inventors
const invNames = SD.inventors.slice(0,25).map(d=>d.name).reverse();
const invEquiv = SD.inventors.slice(0,25).map(d=>d.equiv).reverse();

Plotly.newPlot('ch-inventors', [
  {x:invEquiv, y:invNames, type:'bar', orientation:'h', name:'Brevets IA (équivalent fractionné)',
   marker:{color:P_SS.teal,opacity:.88},
   hovertemplate:'<b>%{y}</b><br>Équiv. fractionné: %{x}<extra></extra>'}
], L({margin:{l:220,r:40,t:10,b:40},
     xaxis:{title:'Brevets IA (pondéré)',showgrid:true,gridcolor:'#f3f4f6',zeroline:false}}), cfg);

// Table: Papers
const paperRows = SD.papers.slice(0,25).map((p,i) => `
  <tr>
    <td class="rank">${i+1}</td>
    <td class="name">${p.title}<br><span style="font-size:11px;color:#9ca3af">${p.year} · ${p.topic}</span></td>
    <td class="num" style="text-align:right">${p.citing_patents}</td>
    <td class="num" style="text-align:right">${p.applicants}</td>
    <td class="num" style="text-align:right">${p.cited_by.toLocaleString('fr-FR')}</td>
  </tr>`).join('');

// Chart: Time series
const colors = P_SS.multi;
const timeTraces = TIME_SERIES.map((d, i) => ({
  x: d.years,
  y: d.equiv,
  type: 'scatter',
  mode: 'lines+markers',
  name: d.name,
  line: {color: colors[i % colors.length], width: 2},
  marker: {size: 4},
  hovertemplate: `<b>${d.name}</b><br>%{x}: %{y:.1f} brevets IA<extra></extra>`
}));

Plotly.newPlot('ch-timeseries', timeTraces, Object.assign({
  margin:{l:55,r:20,t:10,b:50},
  paper_bgcolor:'#fff', plot_bgcolor:'#fff',
  font:{family:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',size:12,color:'#374151'},
  xaxis:{showgrid:false,zeroline:false,title:'Année'},
  yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'Brevets IA (équiv. fractionné)'},
  legend:{orientation:'v',x:1.02,y:1,xanchor:'left'},
  hovermode:'x unified'
}), cfg);

document.getElementById('papers-table').innerHTML = `
  <table class="ss-table">
    <thead><tr>
      <th class="rank">#</th>
      <th>Publication</th>
      <th style="text-align:right">Brevets<br>citants</th>
      <th style="text-align:right">Déposants<br>distincts</th>
      <th style="text-align:right">Citations<br>OpenAlex</th>
    </tr></thead>
    <tbody>${paperRows}</tbody>
  </table>`;
