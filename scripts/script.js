document.addEventListener("DOMContentLoaded", function () {
  fetch("./Components/navbar.html")
    .then((response) => response.text())
    .then((data) => {
      document.getElementById("navbar-placeholder").innerHTML = data;

      const iconNames = ["github", "leetcode", "linkedin", "instagram"];
      for (let icon of iconNames) {
        fetch(`./Components/Icons/${icon}.html`)
          .then((response) => response.text())
          .then((iconData) => {
            document.getElementById("icons").innerHTML += iconData;
          });
      }
    });
    const skills = ["machine_learning", "data_science", "artificial_intelligence", "github"];
    for (let skill of skills) {
        fetch(`./Components/Skills/${skill}.html`)
          .then((response) => response.text())
          .then((skillData) => {
            document.getElementById("skills").innerHTML += skillData;
          });
    }

    const languages = ["python", "javascript", "c", "cpp"];
    for (let language of languages) {
        fetch(`./Components/Languages/${language}.html`)
          .then((response) => response.text())
          .then((languageData) => {
            document.getElementById("languages").innerHTML += languageData;
          });
    }

    const webDevTechs = ["htmlcss", "mongodb", "expressjs", "reactjs", "nodejs"];
    for (let webDevTech of webDevTechs) {
        fetch(`./Components/WebDev/${webDevTech}.html`)
          .then((response) => response.text())
          .then((webDevTechData) => {
            document.getElementById("webdev").innerHTML += webDevTechData;
          });
    }
});
