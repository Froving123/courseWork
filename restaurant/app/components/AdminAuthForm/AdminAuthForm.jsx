"use client";

import React, { useState, useEffect } from "react";
import Styles from "./AdminAuthForm.module.css";
import { useRouter } from "next/navigation";

export const AdminAuthForm = (props) => {
  const [availableRole, setAvailableRole] = useState([]);
  const [isLoginForm, setIsLoginForm] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [copyPassword, setCopyPassword] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchAllRole = async () => {
      try {
        const response = await fetch("/api/admin/roleGet", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();
        if (response.ok) {
          setAvailableRole(result.roles);
        } else {
          setError(result.message || "Ошибка при получении всех должностей");
          setTimeout(() => setError(""), 3000);
        }
      } catch (error) {
        console.error("Ошибка при получении всех должностей:", error);
        setError("Ошибка при получении всех должностей");
        setTimeout(() => setError(""), 3000);
      }
    };

    fetchAllRole();
  }, []);

  const toggleForm = (e) => {
    e.preventDefault();
    setIsLoginForm(!isLoginForm);
    setError("");
  };

  const validateEmail = (email) =>
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(email); // пример для почты

  const validatePassword = (password) => password.length >= 6; // Пример для пароля

  const createPassword = (e) => {
    e.preventDefault();
    // Проверка на заполнение всех полей
    if (!email || !password || !copyPassword) {
      setError("Пожалуйста, заполните все поля");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }

    // проверка на корректность поля password
    if (!validatePassword(password)) {
      setError("Пароль должен быть не менее 6 символов");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }

    if (!validateEmail(email)) {
      setError("Неверный формат email");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }

    // Проверка на совпадение паролей
    if (copyPassword !== password) {
      setError("Пароли не совпадают");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }

    fetch("/api/admin/create-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (!result.success) {
          setError(result.message || "Ошибка при создании пароля");
          setTimeout(() => {
            setError("");
          }, 3000);
          return;
        }

        // Очищаем формы
        setError("");
        setEmail("");
        setCopyPassword("");
        setPassword("");
        alert("Сотрудник успешно создал пароль");
        props.close();
        window.location.reload();
      })
      .catch((error) => {
        console.error("Ошибка при отправке данных на сервер:", error);
        setError("Ошибка при создании пароля");
        setTimeout(() => {
          setError("");
        }, 3000);
      });
  };

  const logIn = (e) => {
    e.preventDefault();

    if (!email || !password || !role) {
      setError("Пожалуйста, заполните все поля");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }

    if (!validateEmail(email)) {
      setError("Неверный формат email");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }

    if (!validatePassword(password)) {
      setError("Пароль должен быть не менее 6 символов");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }

    fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        role, // добавлено поле role
      }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (!result.success) {
          setError(result.message || "Ошибка при авторизации");
          setTimeout(() => {
            setError("");
          }, 3000);
          return;
        }

        // Сохраняем токен в localStorage
        localStorage.setItem("authTokenAdmin", result.token);

        // Обновляем состояние в Header
        props.updateAuthAdmin({ token: result.token });

        // Очищаем формы
        setError("");
        setEmail("");
        setPassword("");
        setCopyPassword("");
        setRole("");
        alert("Сотрудник успешно авторизован");
        props.close();

        // Перенаправляем пользователя на нужную страницу в зависимости от роли
        if (role.toString() === "1") {
          router.push("/Contman/Menu");
        } else if (role.toString() === "2") {
          router.push("/Manord/NewOrder");
        } else if (role.toString() === "3") {
          router.push("/Cour/ReadyOrder");
        } else if (role.toString() === "4") {
          router.push("/Reservman/Reserv");
        }
      })
      .catch((error) => {
        console.error("Ошибка при отправке данных на сервер:", error);
        setError("Ошибка при авторизации");
        setTimeout(() => {
          setError("");
        }, 3000);
      });
  };

  const handleClear = () => {
    setEmail("");
    setPassword("");
    setCopyPassword("");
    setRole("");
  };

  return (
    <form className={Styles["form"]}>
      {isLoginForm ? (
        <>
          <h2 className={Styles["form__title"]}>Авторизация</h2>
          <div className={Styles["form__fields"]}>
            <label className={Styles["form__field"]}>
              <span className={Styles["form__field-title"]}>Email</span>
              <input
                className={Styles["form__field-input"]}
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className={Styles["form__field"]}>
              <span className={Styles["form__field-title"]}>Пароль</span>
              <input
                className={Styles["form__field-input"]}
                type="password"
                placeholder="******"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className={Styles["form__field"]}>
              <span className={Styles["form__field-title"]}>
                Выберите должность
              </span>
              <select
                className={Styles["form__field-input"]}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">Выберите должность</option>
                {availableRole.map((role) => (
                  <option key={role.ID} value={role.ID}>
                    {role.Наименование}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <p className={Styles.error_message}>{error}</p>}
          <div className={Styles["form__actions"]}>
            <button
              className={Styles["form__reset"]}
              type="reset"
              onClick={handleClear}
            >
              Очистить
            </button>
            <button className={Styles["form__transition"]} onClick={toggleForm}>
              Нет пароля
            </button>
            <button onClick={logIn} className={Styles["form__submit"]}>
              Войти
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className={Styles["form__title"]}>Создание пароля</h2>
          <div className={Styles["form__fields"]}>
            <label className={Styles["form__field"]}>
              <span className={Styles["form__field-title"]}>Email</span>
              <input
                className={Styles["form__field-input"]}
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className={Styles["form__field"]}>
              <span className={Styles["form__field-title"]}>Пароль</span>
              <input
                className={Styles["form__field-input"]}
                type="password"
                placeholder="******"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className={Styles["form__field"]}>
              <span className={Styles["form__field-title"]}>
                Подтвердите пароль
              </span>
              <input
                className={Styles["form__field-input"]}
                type="password"
                placeholder="******"
                value={copyPassword}
                onChange={(e) => setCopyPassword(e.target.value)}
              />
            </label>
          </div>
          {error && <p className={Styles.error_message}>{error}</p>}
          <div className={Styles["form__actions"]}>
            <button
              className={Styles["form__reset"]}
              type="reset"
              onClick={handleClear}
            >
              Очистить
            </button>
            <button className={Styles["form__transition"]} onClick={toggleForm}>
              Уже есть пароль
            </button>
            <button onClick={createPassword} className={Styles["form__submit"]}>
              Сохранить пароль
            </button>
          </div>
        </>
      )}
    </form>
  );
};
